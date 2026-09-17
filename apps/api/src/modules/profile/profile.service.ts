import AppError from "#helpers/app-error";
import Profile from "#modules/profile/profile.model";
import User from "#modules/users/user.model";
import {
  AddEducationInput,
  AddExperienceInput,
  CreateProfileInput,
} from "#modules/profile/profile.schemas";
import mongoose, { Types } from "mongoose";
import env from "#config/env";

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

  async getProfiles() {
    const profiles = await Profile.find().populate("userId", [
      "name",
      "avatar",
    ]);
    return profiles;
  }

  async createOrUpdateProfile(userId: string, data: CreateProfileInput) {
    const { facebook, instagram, linkedin, twitter, youtube, ...rest } = data;

    const toSet: Record<string, unknown> = {};
    const toUnset: Record<string, 1> = {};

    for (const [key, value] of Object.entries(rest)) {
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
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const profile = await Profile.findOneAndDelete({ userId }, { session });

      if (!profile) {
        await session.abortTransaction();
        throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");
      }

      const user = await User.findOneAndDelete({ _id: userId }, { session });
      if (!user) {
        await session.abortTransaction();
        throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");
      }

      await session.commitTransaction();
    } catch (err) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }
  async addExperience(userId: string, data: AddExperienceInput) {
    const { title, company, location, from, to, current, description } = data;

    const toDate = to ? new Date(to) : undefined;
    const fromDate = new Date(from);

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
    const response = await fetch(
      `https://api.github.com/users/${username}/repos?per_page=5&sort=created&direction=asc`,
      {
        headers: {
          "User-Agent": "node.js",
          Accept: "application/vnd.github.v3+json",
          Authorization: `token ${env.GITHUB_ACCESS_TOKEN}`,
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
