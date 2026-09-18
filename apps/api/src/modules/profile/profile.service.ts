import AppError from "#helpers/app-error";
import env from "#config/env";
import Profile from "#modules/profile/profile.model";
import User from "#modules/users/user.model";
import Post from "#modules/posts/posts.model";
import Session from "#modules/auth/session.model";
import {
  AddEducationInput,
  AddExperienceInput,
  CreateProfileInput,
  UpdateProfileInput,
} from "#modules/profile/profile.schemas";
import mongoose, { Types } from "mongoose";
import {
  sanitizePlainText,
  sanitizeUrl,
  sanitizeGithubUsername,
} from "#helpers/sanitize";

/**
 * Validates experience/education date combinations that JSON Schema
 * cannot express (cross-field rules). Throws 400 instead of letting
 * `new Date()` produce `Invalid Date` cast errors (500s).
 */
function validateDateRange(
  from: string,
  to: string | undefined,
  current: boolean | undefined,
  kind: "Experience" | "Education",
): { fromDate: Date; toDate?: Date } {
  const fromDate = new Date(from);
  if (Number.isNaN(fromDate.getTime())) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `${kind} 'from' is not a valid date`,
    );
  }
  let toDate: Date | undefined;
  if (to !== undefined) {
    toDate = new Date(to);
    if (Number.isNaN(toDate.getTime())) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        `${kind} 'to' is not a valid date`,
      );
    }
    if (toDate < fromDate) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        `${kind} 'to' must be after 'from'`,
      );
    }
  }
  if (current === true && toDate !== undefined) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `${kind} cannot have both 'current: true' and a 'to' date`,
    );
  }
  return { fromDate, toDate };
}

class ProfileService {
  /**
   * Looks up by user id first, then falls back to profile `_id`, so
   * `GET /profile/user/:id` works regardless of which id the client holds.
   */
  async getProfile(id: string) {
    let profile = await Profile.findOne({ userId: id }).populate("userId", [
      "name",
      "avatar",
    ]);
    if (!profile && Types.ObjectId.isValid(id)) {
      profile = await Profile.findById(id).populate("userId", [
        "name",
        "avatar",
      ]);
    }

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
        if (key === "status" || key === "skills") continue;
        toUnset[key] = 1;
      } else if (value !== undefined) {
        if (key === "website") {
          const sanitized = sanitizeUrl(value as string | undefined | null);
          if (sanitized) toSet[key] = sanitized;
          else toUnset[key] = 1;
        } else if (key === "githubusername") {
          const sanitized = sanitizeGithubUsername(
            value as string | undefined | null,
          );
          if (sanitized) toSet[key] = sanitized;
          else toUnset[key] = 1;
        } else if (typeof value === "string") {
          toSet[key] = sanitizePlainText(value);
        } else if (Array.isArray(value)) {
          toSet[key] = value.map((v) =>
            sanitizePlainText(v as string | undefined | null),
          );
        } else {
          toSet[key] = value;
        }
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
        const sanitized = sanitizeUrl(value as string | undefined | null);
        if (sanitized) toSet[`social.${key}`] = sanitized;
        else toUnset[`social.${key}`] = 1;
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

  /**
   * Partial update (PUT /profile). Unlike POST create-or-update, this never
   * upserts: the profile must already exist (created via POST with required
   * `status`/`skills`), so a partial payload cannot insert an invalid doc.
   */
  async updateProfile(userId: string, data: UpdateProfileInput) {
    if (!data || Object.keys(data).length === 0) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "At least one field is required",
      );
    }
    // Reuse the same $set/$unset builder, but without upsert.
    const existing = await Profile.findOne({ userId });
    if (!existing) {
      throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");
    }
    const updated = await this.createOrUpdateProfileNoUpsert(userId, data);
    return updated;
  }

  private async createOrUpdateProfileNoUpsert(
    userId: string,
    data: UpdateProfileInput,
  ) {
    const { facebook, instagram, linkedin, twitter, youtube, ...rest } =
      data as Record<string, unknown>;

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
        toUnset[key] = 1;
      } else if (value !== undefined) {
        if (key === "website") {
          const sanitized = sanitizeUrl(value as string | undefined | null);
          if (sanitized) toSet[key] = sanitized;
          else toUnset[key] = 1;
        } else if (key === "githubusername") {
          const sanitized = sanitizeGithubUsername(
            value as string | undefined | null,
          );
          if (sanitized) toSet[key] = sanitized;
          else toUnset[key] = 1;
        } else if (typeof value === "string") {
          toSet[key] = sanitizePlainText(value);
        } else if (Array.isArray(value)) {
          toSet[key] = value.map((v) =>
            sanitizePlainText(v as string | undefined | null),
          );
        } else {
          toSet[key] = value;
        }
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
        const sanitized = sanitizeUrl(value as string | undefined | null);
        if (sanitized) toSet[`social.${key}`] = sanitized;
        else toUnset[`social.${key}`] = 1;
      }
    }

    // Strip attempts to wipe required fields — schema rejects ""/null for
    // them, but direct service callers bypass validation.
    delete toUnset.status;
    delete toUnset.skills;

    const update: Record<string, Record<string, unknown>> = {};
    if (Object.keys(toSet).length) update.$set = toSet;
    if (Object.keys(toUnset).length) update.$unset = toUnset;
    if (!Object.keys(update).length) {
      const current = await Profile.findOne({ userId });
      if (!current) {
        throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");
      }
      return current.toJSON();
    }

    const profile = await Profile.findOneAndUpdate({ userId }, update, {
      returnDocument: "after",
      upsert: false,
      runValidators: true,
      context: "query",
    });
    if (!profile) {
      throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");
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
        throw new AppError(404, "USER_NOT_FOUND", "User not found");
      }

      // Cascade: remove user's posts/comments/likes remnants and sessions.
      // Match both ObjectId and legacy string forms of userId.
      const uid = new Types.ObjectId(userId);
      await Post.deleteMany({ userId: uid }, opts);
      await Post.updateMany(
        {},
        {
          $pull: {
            likes: { userId: { $in: [uid, userId] } },
            comments: { userId: { $in: [uid, userId] } },
          },
        },
        opts,
      );
      await Session.deleteMany({ userId: uid }, opts);

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

    const { fromDate, toDate } = validateDateRange(
      from,
      to,
      current,
      "Experience",
    );

    // Build experience object, only including optional fields when provided
    const experience: Record<string, unknown> = {
      title: sanitizePlainText(title),
      company: sanitizePlainText(company),
      from: fromDate,
      current,
    };
    if (location !== undefined)
      experience.location = sanitizePlainText(location);
    if (toDate !== undefined) experience.to = toDate;
    if (description !== undefined)
      experience.description = sanitizePlainText(description);

    // Atomic $push: concurrent adds can no longer lose entries.
    const profile = await Profile.findOneAndUpdate(
      { userId },
      {
        $push: {
          experience,
        },
      },
      { new: true },
    );

    if (!profile) {
      throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");
    }

    return {
      profile,
    };
  }

  async addEducation(userId: string, data: AddEducationInput) {
    const { school, degree, fieldofstudy, from, to, current, description } =
      data;
    const { fromDate, toDate } = validateDateRange(
      from,
      to,
      current,
      "Education",
    );

    // Build education object, only including optional fields when provided
    const education: Record<string, unknown> = {
      school: sanitizePlainText(school),
      degree: sanitizePlainText(degree),
      fieldofstudy: sanitizePlainText(fieldofstudy),
      from: fromDate,
      current,
    };
    if (toDate !== undefined) education.to = toDate;
    if (description !== undefined)
      education.description = sanitizePlainText(description);

    // Atomic $push: concurrent adds can no longer lose entries.
    const profile = await Profile.findOneAndUpdate(
      { userId },
      {
        $push: {
          education,
        },
      },
      { new: true },
    );

    if (!profile) {
      throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");
    }

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
    let token: string;
    try {
      token = env.GITHUB_ACCESS_TOKEN;
    } catch {
      throw new AppError(
        500,
        "GITHUB_CONFIG_ERROR",
        "GitHub integration is not configured",
      );
    }
    if (!token) {
      throw new AppError(
        500,
        "GITHUB_CONFIG_ERROR",
        "GitHub integration is not configured",
      );
    }
    // Normalize cache key (GitHub logins are case-insensitive) to avoid
    // duplicate entries for "OctoCat" vs "octocat".
    const safeUsername = encodeURIComponent(username);
    const cacheKey = safeUsername.toLowerCase();
    const cached = getCachedGithubRepos(cacheKey);
    if (cached) return cached;
    const response = await fetch(
      `https://api.github.com/users/${safeUsername}/repos?per_page=5&sort=created&direction=asc`,
      {
        signal: AbortSignal.timeout(8000),
        headers: {
          "User-Agent": "node.js",
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new AppError(404, "GITHUB_REPOS_NOT_FOUND", "No repos found");
      }
      if (response.status === 401) {
        throw new AppError(
          401,
          "GITHUB_AUTH_FAILED",
          "GitHub authentication failed",
        );
      }
      if (response.status === 403 || response.status === 429) {
        throw new AppError(
          response.status,
          "GITHUB_RATE_LIMITED",
          "GitHub rate limit exceeded",
        );
      }
      if (response.status >= 500) {
        throw new AppError(502, "GITHUB_UPSTREAM_ERROR", "GitHub server error");
      }
      throw new AppError(502, "GITHUB_UPSTREAM_ERROR", "GitHub upstream error");
    }
    const repos = await response.json();
    setCachedGithubRepos(cacheKey, repos);
    return repos;
  }
}

const GITHUB_CACHE_TTL_MS = 60_000;
const GITHUB_CACHE_MAX_ENTRIES = 200;
const githubReposCache = new Map<
  string,
  { expiresAt: number; data: unknown }
>();

function getCachedGithubRepos(key: string): unknown | undefined {
  const entry = githubReposCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    githubReposCache.delete(key);
    return undefined;
  }
  return entry.data;
}

function setCachedGithubRepos(key: string, data: unknown): void {
  if (githubReposCache.size >= GITHUB_CACHE_MAX_ENTRIES) {
    // Evict the oldest entry (Maps preserve insertion order).
    const oldest = githubReposCache.keys().next();
    if (!oldest.done) githubReposCache.delete(oldest.value);
  }
  githubReposCache.set(key, {
    expiresAt: Date.now() + GITHUB_CACHE_TTL_MS,
    data,
  });
}

/** Clears the GitHub repos cache. Exported for tests. */
export function clearGithubReposCache(): void {
  githubReposCache.clear();
}

export const profileService = new ProfileService();
