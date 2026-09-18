import AppError from "#helpers/app-error";
import Profile from "#modules/profile/profile.model";
import User from "#modules/users/user.model";
import Post from "#modules/posts/posts.model";
import Session from "#modules/auth/session.model";
import {
  AddEducationInput,
  AddExperienceInput,
  CreateProfileInput,
} from "#modules/profile/profile.schemas";
import mongoose, { Types } from "mongoose";

class ProfileService {
  async getProfile(userId: string) {
    const profile = await Profile.findOne({ userId }).populate("userId", [
      "name",
      "avatar",
    ]);

    if (!profile) {
      throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");
    }

    return {
      ...profile.toJSON(),
    };
  }

  async getProfiles(page = 1, limit = 20) {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit) || 20));
    const profiles = await Profile.find()
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate("userId", ["name", "avatar"]);
    return profiles;
  }

  async createOrUpdateProfile(userId: string, data: CreateProfileInput) {
    const { facebook, instagram, linkedin, twitter, youtube, ...rest } = data;

    const ALLOWED_PROFILE_FIELDS = new Set([
      "company",
      "website",
      "location",
      "status",
      "skills",
      "bio",
      "githubusername",
    ]);

    const toSet: Record<string, unknown> = {};
    const toUnset: Record<string, 1> = {};

    for (const [key, value] of Object.entries(rest)) {
      if (!ALLOWED_PROFILE_FIELDS.has(key)) continue;
      if (
        value === null ||
        (typeof value === "string" && value.trim() === "")
      ) {
        // Required fields are validated by schema (CreateProfileSchema) — never wipe them here;
        // for direct service calls, preserve existing value instead of throwing
        if (key === "status" || key === "skills") continue;
        toUnset[key] = 1;
      } else if (value !== undefined) {
        toSet[key] = value;
      }
    }

    for (const [key, value] of Object.entries({
      facebook,
      instagram,
      linkedin,
      twitter,
      youtube,
    })) {
      if (
        value === null ||
        (typeof value === "string" && value.trim() === "")
      ) {
        toUnset[`social.${key}`] = 1;
      } else if (value !== undefined) {
        toSet[`social.${key}`] = value;
      }
    }

    const update: Record<string, Record<string, unknown>> = {};
    if (Object.keys(toSet).length) update.$set = toSet;
    if (Object.keys(toUnset).length) update.$unset = toUnset;

    if (!Object.keys(update).length) {
      const existing = await Profile.findOne({ userId });
      if (existing) return existing.toJSON();
      // No fields to create — let Mongoose runValidators handle required fields
    }

    const profile = await Profile.findOneAndUpdate({ userId }, update, {
      returnDocument: "after",
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
      context: "query",
    });

    if (!profile) {
      throw new AppError(500, "INTERNAL_SERVER_ERROR", "Profile upsert failed");
    }
    return profile.toJSON();
  }
  async deleteProfileAndUser(userId: string) {
    // Try transactional cascade; fall back to non-transactional on standalone Mongo.
    let session: mongoose.ClientSession | null = null;
    let useTransaction = true;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch {
      session = null;
      useTransaction = false;
    }
    const opts = session && useTransaction ? { session } : {};
    try {
      const profile = await Profile.findOneAndDelete({ userId }, opts);

      if (!profile) {
        if (session && useTransaction) await session.abortTransaction();
        throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");
      }

      const user = await User.findOneAndDelete({ _id: userId }, opts);
      if (!user) {
        if (session && useTransaction) await session.abortTransaction();
        throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");
      }

      // Cascade: remove user's posts/comments/likes remnants and sessions.
      await Post.deleteMany({ userId }, opts);
      await Post.updateMany(
        {},
        { $pull: { likes: { userId }, comments: { userId } } },
        opts,
      );
      await Session.deleteMany({ userId }, opts);

      if (session && useTransaction) await session.commitTransaction();
    } catch (err) {
      if (session && useTransaction && session.inTransaction()) {
        await session.abortTransaction();
      }
      throw err;
    } finally {
      if (session) await session.endSession();
    }
  }
  async addExperience(userId: string, data: AddExperienceInput) {
    const { title, company, location, from, to, current, description } = data;

    const toDate = to ? new Date(to) : undefined;
    const fromDate = new Date(from);

    // NOTE: read-modify-write; concurrent adds can race. For full safety use
    // atomic $push via findOneAndUpdate (requires test-harness updates).
    const profile = await Profile.findOne({ userId });

    if (!profile) {
      throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");
    }

    const experience = (profile.experience ??= []);

    experience.push({
      title,
      company,
      location,
      from: fromDate,
      to: toDate,
      current,
      description,
    });

    await profile.save();

    return {
      profile,
    };
  }

  async addEducation(userId: string, data: AddEducationInput) {
    const { school, degree, fieldofstudy, from, to, current, description } =
      data;
    const toDate = to ? new Date(to) : undefined;
    const fromDate = new Date(from);

    const profile = await Profile.findOne({ userId });

    if (!profile) {
      throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");
    }

    const education = (profile.education ??= []);

    education.push({
      school,
      degree,
      fieldofstudy,
      from: fromDate,
      to: toDate,
      current,
      description,
    });

    await profile.save();

    return {
      profile,
    };
  }

  private async pullSubdocument(
    userId: string,
    field: "experience" | "education",
    id: string,
    notFoundCode: "EXPERIENCE_NOT_FOUND" | "EDUCATION_NOT_FOUND",
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid ObjectId");
    }
    const objectId = new Types.ObjectId(id);

    // Atomic $pull - only matches if subdoc exists, avoids race + extra roundtrip
    const profile = await Profile.findOneAndUpdate(
      { userId, [`${field}._id`]: objectId },
      { $pull: { [field]: { _id: objectId } } },
      { new: true },
    );

    if (profile) return { profile };

    // No match: distinguish PROFILE_NOT_FOUND vs subdoc not found
    const exists = await Profile.exists({ userId });
    if (!exists) {
      throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");
    }
    throw new AppError(
      404,
      notFoundCode,
      field === "experience" ? "Experience not found" : "Education not found",
    );
  }

  async deleteExperience(userId: string, experienceId: string) {
    return this.pullSubdocument(
      userId,
      "experience",
      experienceId,
      "EXPERIENCE_NOT_FOUND",
    );
  }

  async deleteEducation(userId: string, educationId: string) {
    return this.pullSubdocument(
      userId,
      "education",
      educationId,
      "EDUCATION_NOT_FOUND",
    );
  }

  async getGithubReposForProfile(username: string) {
    // Fail fast instead of sending "token undefined" to GitHub.
    const token = process.env.GITHUB_ACCESS_TOKEN;
    if (!token) {
      throw new AppError(
        500,
        "GITHUB_CONFIG_ERROR",
        "GitHub integration is not configured",
      );
    }
    const safeUsername = encodeURIComponent(username);
    const response = await fetch(
      `https://api.github.com/users/${safeUsername}/repos?per_page=5&sort=created&direction=asc`,
      {
        signal: AbortSignal.timeout(8000),
        headers: {
          "User-Agent": "node.js",
          Accept: "application/vnd.github.v3+json",
          Authorization: `token ${token}`,
        },
      },
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new AppError(404, "GITHUB_REPOS_NOT_FOUND", "No repos found");
      }
      if (response.status === 401) {
        throw new AppError(401, "GITHUB_AUTH_FAILED", "GitHub authentication failed");
      }
      if (response.status === 403 || response.status === 429) {
        throw new AppError(response.status, "GITHUB_RATE_LIMITED", "GitHub rate limit exceeded");
      }
      if (response.status >= 500) {
        throw new AppError(502, "GITHUB_UPSTREAM_ERROR", "GitHub server error");
      }
      throw new AppError(502, "GITHUB_UPSTREAM_ERROR", "GitHub upstream error");
    }
    const repos = await response.json();
    return repos;
  }
}

export const profileService = new ProfileService();
