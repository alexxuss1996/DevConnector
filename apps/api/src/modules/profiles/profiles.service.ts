import AppError from "#helpers/app-error";
import env from "#config/env";
import Profile, {
  type ProfileDocument,
} from "#modules/profiles/profiles.model";
import User from "#modules/users/user.model";
import Post from "#modules/posts/posts.model";
import Session from "#modules/auth/session.model";
import {
  AddEducationInput,
  AddExperienceInput,
  CreateProfileInput,
  PublicProfile,
  PublicProfileSummary,
  UpdateProfileInput,
} from "@dev-conn/contracts";
import mongoose, { Types } from "mongoose";
import { sanitizePlainText } from "#helpers/sanitize";
import { isDuplicateKeyError } from "#helpers/mongo";
import {
  getCachedGithubRepos,
  setCachedGithubRepos,
} from "#helpers/github.cache";
import {
  buildProfileUpdate,
  mapDates,
  toOwner,
  validateDateRange,
} from "#helpers/profile";

class ProfileService {
  /**
   * The single place a profile becomes a wire shape. Populates the owner and
   * normalises `_id`/timestamps, so every read and write returns the same
   * object and satisfies `PublicProfileSchema`.
   */
  private async toPublicProfile(doc: ProfileDocument): Promise<PublicProfile> {
    await doc.populate("userId", ["name", "avatar"]);
    const json = doc.toJSON() as Record<string, unknown>;
    return {
      ...(json as Omit<PublicProfile, "_id" | "userId">),
      _id: String(json._id),
      userId: toOwner(json.userId) ?? { _id: "" },
      // Mongoose defaults arrays to [], but a subdocument object is only
      // present if it was ever written — keep the response schema's required
      // fields genuinely present.
      // Mongoose renders subdocument `Date`s as full ISO timestamps, but the
      // contract declares `format: "date"`. Emit `YYYY-MM-DD` so the schema
      // is truthful and clients can't be caught out by a timezone.
      experience: mapDates(json.experience as PublicProfile["experience"]),
      education: mapDates(json.education as PublicProfile["education"]),
      social: (json.social as PublicProfile["social"]) ?? {},
      createdAt: json.createdAt ? String(json.createdAt) : undefined,
      updatedAt: json.updatedAt ? String(json.updatedAt) : undefined,
    };
  }

  /** Fields a directory listing needs. Keeps `experience`, `education` and
   * `social` off the wire for a list page. */
  private static readonly SUMMARY_FIELDS =
    "_id userId status company location skills";

  /**
   * Looks up by user id or profile `_id` in one query, so
   * `GET /profiles/user/:id` works regardless of which id the client holds
   * without a second round trip on a miss.
   */
  async getProfile(id: string) {
    // A legacy non-ObjectId `userId` is still supported, but querying an
    // ObjectId path with a non-hex string raises a CastError (a 500), so such
    // an id can only be a miss.
    if (!Types.ObjectId.isValid(id) && !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
      throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");
    }

    const filter = Types.ObjectId.isValid(id)
      ? { $or: [{ userId: id }, { _id: id }] }
      : { userId: id };

    const profile = await Profile.findOne(filter).populate("userId", [
      "name",
      "avatar",
    ]);

    if (!profile) {
      throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");
    }
    return this.toPublicProfile(profile);
  }

  /** A page of directory summaries plus the unpaginated total.
   *  `page`/`limit` must come from `parsePagination`, the single clamp. */
  async getProfiles(page = 1, limit = 20) {
    const [profiles, total] = await Promise.all([
      Profile.find()
        .select(ProfileService.SUMMARY_FIELDS)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("userId", ["name", "avatar"]),
      Profile.countDocuments({}),
    ]);

    // A profile whose user was deleted populates `userId` to null, and there
    // is no public page to link to — drop it rather than emit an owner with
    // `_id: "null"`, which would render a card linking to `/profiles/null`.
    const summaries: PublicProfileSummary[] = profiles.flatMap((doc) => {
      const owner = toOwner(doc.toJSON().userId);
      if (!owner) return [];
      return [
        {
          _id: String(doc._id),
          userId: owner,
          status: doc.status,
          company: doc.company,
          location: doc.location,
          skills: doc.skills,
        },
      ];
    });

    return { profiles: summaries, total };
  }

  /**
   * Creates a profile for a user that does not have one yet. `POST` means
   * create: an existing profile is a 409 rather than a silent overwrite.
   */
  async createProfile(userId: string, data: CreateProfileInput) {
    const exists = await Profile.exists({ userId });
    if (exists) {
      throw new AppError(
        409,
        "PROFILE_ALREADY_EXISTS",
        "Profile already exists",
      );
    }
    const { $set } = buildProfileUpdate(data);
    try {
      // A real insert, not an upsert: with `upsert` the `userId` filter would
      // *match* a profile created after the check above and `$set` over it, so
      // the loser of the race would silently overwrite the winner. An insert
      // always trips the unique index on `userId` instead.
      const created = await Profile.create({ userId, ...$set });
      return await this.toPublicProfile(created);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new AppError(
          409,
          "PROFILE_ALREADY_EXISTS",
          "Profile already exists",
        );
      }
      throw error;
    }
  }

  async createOrUpdateProfile(userId: string, data: CreateProfileInput) {
    const { $set, $unset } = buildProfileUpdate(data);
    const update: Record<string, Record<string, unknown>> = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;

    if (!Object.keys(update).length) {
      const existing = await Profile.findOne({ userId });
      if (existing) return this.toPublicProfile(existing);
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
    return this.toPublicProfile(profile);
  }

  /**
   * Partial update (PATCH /profiles). Unlike POST create-or-update, this never
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
    const { $set, $unset } = buildProfileUpdate(data);

    // Strip attempts to wipe required fields — schema rejects ""/null for
    // them, but direct service callers bypass validation.
    delete $unset.status;
    delete $unset.skills;

    const update: Record<string, Record<string, unknown>> = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;
    if (!Object.keys(update).length) {
      const current = await Profile.findOne({ userId });
      if (!current) {
        throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");
      }
      return this.toPublicProfile(current);
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
    return this.toPublicProfile(profile);
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
      profile: await this.toPublicProfile(profile),
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
      profile: await this.toPublicProfile(profile),
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

    if (profile) return { profile: await this.toPublicProfile(profile) };

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

export const profileService = new ProfileService();
