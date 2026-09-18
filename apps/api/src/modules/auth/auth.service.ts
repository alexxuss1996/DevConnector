import User from "#modules/users/user.model";
import Session from "#modules/auth/session.model";
import AppError from "#helpers/app-error";
import argon2 from "argon2";
import gravatarUrl from "gravatar-url";
import { FastifyInstance } from "fastify";

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

interface GoogleUser {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

export const GOOGLE_USERINFO_URL =
  "https://openidconnect.googleapis.com/v1/userinfo";

class AuthService {
  private async getGoogleUser(accessToken: string): Promise<GoogleUser> {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new AppError(
        401,
        "GOOGLE_AUTH_FAILED",
        "Invalid Google access token",
      );
    }

    const user = (await response.json()) as GoogleUser;

    if (!user.email_verified) {
      throw new AppError(
        401,
        "GOOGLE_AUTH_FAILED",
        "Google Email is not verified",
      );
    }

    if (!user.sub || !user.email) {
      throw new AppError(401, "GOOGLE_AUTH_FAILED", "Google User is invalid");
    }

    return user;
  }
  private async createSession(fastify: FastifyInstance, userId: string) {
    const session = new Session({
      userId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const refreshToken = fastify.jwt.sign(
      {
        sub: userId,
        type: "refresh",
        sessionId: session._id.toString(),
      },
      {
        expiresIn: "30d",
      },
    );

    session.refreshTokenHash = await argon2.hash(refreshToken);

    await session.save();

    const accessToken = fastify.jwt.sign(
      {
        sub: userId,
        type: "access",
        sessionId: session._id.toString(),
      },
      {
        expiresIn: "15m",
      },
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  private async revokeSession(sessionId: string) {
    const session = await Session.findOneAndUpdate(
      {
        _id: sessionId,
        revokedAt: { $exists: false },
      },
      {
        $set: {
          revokedAt: new Date(),
        },
      },
    );

    if (!session) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid Credentials");
    }
  }

  async login(fastify: FastifyInstance, data: LoginInput) {
    const { email, password } = data;

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail }).select(
      "+passwordHash",
    );

    if (!user) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid Credentials");
    }

    if (!user.passwordHash) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid Credentials");
    }

    const isPasswordCorrect = await argon2.verify(user.passwordHash, password);

    if (!isPasswordCorrect) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid Credentials");
    }

    const { accessToken, refreshToken } = await this.createSession(
      fastify,
      user._id.toString(),
    );

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
      accessToken,
      refreshToken,
    };
  }

  async register(fastify: FastifyInstance, data: RegisterInput) {
    const { name, email, password } = data;
    const normalizedEmail = email.toLowerCase().trim();
    const trimmedName = name.trim();

    let existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      throw new AppError(409, "REGISTRATION_FAILED", "Email already in use");
    }

    const passwordHash = await argon2.hash(password);

    const gravatar = gravatarUrl(normalizedEmail, {
      size: 200,
      rating: "pg",
      default: "retro",
    });

    let user;
    try {
      user = await User.create({
        name: trimmedName,
        email: normalizedEmail,
        passwordHash: passwordHash,
        avatar: gravatar,
      });
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 11000) {
        throw new AppError(409, "REGISTRATION_FAILED", "Email already in use");
      }
      throw err;
    }

    const { accessToken, refreshToken } = await this.createSession(
      fastify,
      user._id.toString(),
    );

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },

      accessToken,
      refreshToken,
    };
  }

  /**
   * Google login. Never merges on email match: a Google `sub` either maps
   * to an existing linked user, or — when the email is unused — creates a
   * new account. An existing password account with the same email gets a
   * 409 so the owner can link explicitly via `linkGoogleAccount` from an
   * authenticated session (proving ownership of both sides).
   */
  async authenticateGoogle(
    fastify: FastifyInstance,
    googleAccessToken: string,
  ) {
    const googleUser = await this.getGoogleUser(googleAccessToken);

    const email = googleUser.email.toLowerCase().trim();

    let user = await User.findOne({ googleId: googleUser.sub }).select(
      "+googleId",
    );

    if (!user) {
      // No linked account: fail closed when the email is taken instead of
      // hijacking/merging into someone else's account.
      const existing = await User.findOne({ email }).select("+googleId");
      if (existing) {
        throw new AppError(
          409,
          "GOOGLE_ACCOUNT_CONFLICT",
          "An account with this email already exists. Log in and link Google from your account settings.",
        );
      }
      const fallbackName =
        googleUser.name ?? email.split("@")[0] ?? "Google User";
      try {
        user = await User.create({
          email,
          googleId: googleUser.sub,
          name: fallbackName,
          avatar: googleUser.picture,
        });
      } catch (err: unknown) {
        if ((err as { code?: number }).code === 11000) {
          throw new AppError(
            409,
            "GOOGLE_ACCOUNT_CONFLICT",
            "Account already exists",
          );
        }
        throw err;
      }
    } else if (user.email !== email) {
      // Google sub is stable; email may change on Google's side.
      user.email = email;
      try {
        await user.save();
      } catch (err: unknown) {
        if ((err as { code?: number }).code === 11000) {
          throw new AppError(
            409,
            "GOOGLE_ACCOUNT_CONFLICT",
            "This Google account's email is already in use",
          );
        }
        throw err;
      }
    }

    const { accessToken, refreshToken } = await this.createSession(
      fastify,
      user._id.toString(),
    );

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Links a Google identity to the currently authenticated user. The caller
   * must already own the local account (via `authenticate`), and the Google
   * token must belong to a verified email — proving ownership of both sides
   * before any merge. The Google `sub`/email must not belong to anyone else.
   */
  async linkGoogleAccount(userId: string, googleAccessToken: string) {
    const googleUser = await this.getGoogleUser(googleAccessToken);
    const email = googleUser.email.toLowerCase().trim();

    const taken = await User.findOne({ googleId: googleUser.sub }).select(
      "+googleId",
    );
    if (taken && taken._id.toString() !== userId) {
      throw new AppError(
        409,
        "GOOGLE_ACCOUNT_CONFLICT",
        "This Google account is already linked to another user",
      );
    }

    const user = await User.findById(userId).select("+googleId");
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }
    if (user.googleId && user.googleId !== googleUser.sub) {
      throw new AppError(
        409,
        "GOOGLE_ACCOUNT_CONFLICT",
        "Your account is already linked to a different Google account",
      );
    }

    // Another user may hold the Google email address: linking would create
    // two accounts claiming the same email.
    const emailOwner = await User.findOne({ email }).select("_id");
    if (emailOwner && emailOwner._id.toString() !== userId) {
      throw new AppError(
        409,
        "GOOGLE_ACCOUNT_CONFLICT",
        "This Google email is already in use by another account",
      );
    }

    user.googleId = googleUser.sub;
    try {
      await user.save();
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 11000) {
        throw new AppError(
          409,
          "GOOGLE_ACCOUNT_CONFLICT",
          "This Google account is already linked elsewhere",
        );
      }
      throw err;
    }
    return { googleId: user.googleId };
  }

  /** Removes the Google link from the currently authenticated user. */
  async unlinkGoogleAccount(userId: string) {
    const user = await User.findById(userId).select(
      "+googleId +passwordHash",
    );
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }
    if (!user.googleId) {
      throw new AppError(404, "GOOGLE_NOT_LINKED", "No Google account linked");
    }
    // Google-only accounts would lock themselves out — require a password.
    if (!user.passwordHash) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Set a password before unlinking your Google account",
      );
    }
    await User.updateOne({ _id: userId }, { $unset: { googleId: 1 } });
  }

  async refresh(fastify: FastifyInstance, token: string) {
    let payload: {
      sub: string;
      type: "refresh";
      sessionId: string;
    };

    try {
      payload = fastify.jwt.verify<{
        sub: string;
        type: "refresh";
        sessionId: string;
      }>(token);
    } catch {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid Credentials");
    }

    if (payload.type !== "refresh") {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid Credentials");
    }

    const session = await Session.findById(payload.sessionId).select(
      "+userId +refreshTokenHash",
    );

    if (!session) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid Credentials");
    }
    if (payload.sub !== session.userId.toString()) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid Credentials");
    }

    if (session.revokedAt) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid Credentials");
    }

    if (session.expiresAt <= new Date()) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid Credentials");
    }

    const isValid = await argon2.verify(session.refreshTokenHash!, token);

    if (!isValid) {
      // Reuse detected: stolen/old token presented — revoke the whole session.
      await Session.findByIdAndUpdate(session._id, {
        $set: { revokedAt: new Date() },
      });
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid Credentials");
    }

    const user = await User.findById(session.userId);

    if (!user) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid Credentials");
    }

    const refreshToken = fastify.jwt.sign(
      {
        sub: user._id.toString(),
        type: "refresh",
        sessionId: session._id.toString(),
      },
      {
        expiresIn: "30d",
      },
    );

    const newHash = await argon2.hash(refreshToken);
    // Sliding expiry: DB row lives as long as the newest refresh JWT (30d
    // from now), so the two never disagree about session lifetime.
    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    if (typeof (session as any).__v === "number") {
      // Optimistic concurrency: only one parallel refresh can win. The loser
      // sees no match and is treated as a token reuse (session already rotated).
      const updated = await Session.findOneAndUpdate(
        { _id: session._id, __v: (session as any).__v },
        {
          $set: { refreshTokenHash: newHash, expiresAt: newExpiresAt },
          $inc: { __v: 1 },
        },
        { new: true },
      );
      if (!updated) {
        throw new AppError(401, "INVALID_CREDENTIALS", "Invalid Credentials");
      }
    } else {
      // Stubbed/plain session objects in tests carry no __v — fall back to save.
      session.refreshTokenHash = newHash;
      session.expiresAt = newExpiresAt;
      await session.save();
    }

    const accessToken = fastify.jwt.sign(
      {
        sub: user._id.toString(),
        type: "access",
        sessionId: session._id.toString(),
      },
      {
        expiresIn: "15m",
      },
    );

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
      accessToken,
      refreshToken,
    };
  }
  async logout(fastify: FastifyInstance, refreshToken: string) {
    let payload: {
      sub: string;
      type: "refresh";
      sessionId: string;
    };

    try {
      payload = fastify.jwt.verify<{
        sub: string;
        type: "refresh";
        sessionId: string;
      }>(refreshToken);
    } catch {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid Credentials");
    }

    if (payload.type !== "refresh") {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid Credentials");
    }

    await this.revokeSession(payload.sessionId);
  }

  /** Revokes every session for a user (log out everywhere). */
  async logoutAll(userId: string) {
    await Session.updateMany(
      { userId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
  }
}

export const authService = new AuthService();
