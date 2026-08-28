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
      throw new Error("Google User is invalid");
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

    const isPasswordCorrect = await argon2.verify(user.passwordHash!, password);

    if (!isPasswordCorrect) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid Credentials");
    }

    const { accessToken, refreshToken } = await this.createSession(
      fastify,
      user._id.toString(),
    );

    return {
      user: {
        id: user._id,
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

    let existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      throw new AppError(400, "REGISTRATION_FAILED", "Registration failed");
    }

    const passwordHash = await argon2.hash(password);

    const gravatar = gravatarUrl(normalizedEmail, {
      size: 200,
      rating: "pg",
      default: "retro",
    });

    const user = await User.create({
      name,
      email: normalizedEmail,
      passwordHash: passwordHash,
      avatar: gravatar,
    });

    const { accessToken, refreshToken } = await this.createSession(
      fastify,
      user._id.toString(),
    );

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },

      accessToken,
      refreshToken,
    };
  }

  async authenticateGoogle(
    fastify: FastifyInstance,
    googleAccessToken: string,
  ) {
    const googleUser = await this.getGoogleUser(googleAccessToken);

    const email = googleUser.email.toLowerCase().trim();

    let user = await User.findOne({
      $or: [{ googleId: googleUser.sub }, { email }],
    });

    if (!user) {
      user = await User.create({
        email,
        googleId: googleUser.sub,
        name: googleUser.name,
        avatar: googleUser.picture,
      });
    } else {
      if (user.googleId && user.googleId !== googleUser.sub) {
        throw new AppError(
          409,
          "GOOGLE_ACCOUNT_CONFLICT",
          "Google account is already linked",
        );
      }

      if (!user.googleId) {
        user.googleId = googleUser.sub;
        user.name ??= googleUser.name;
        user.avatar ??= googleUser.picture;

        await user.save();
      }
    }

    const { accessToken, refreshToken } = await this.createSession(
      fastify,
      user._id.toString(),
    );

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
      accessToken,
      refreshToken,
    };
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

    session.refreshTokenHash = await argon2.hash(refreshToken);

    await session.save();

    const accessToken = fastify.jwt.sign(
      {
        sub: user._id.toString(),
        type: "access",
      },
      {
        expiresIn: "15m",
      },
    );

    return {
      user: {
        id: user._id,
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
}

export const authService = new AuthService();
