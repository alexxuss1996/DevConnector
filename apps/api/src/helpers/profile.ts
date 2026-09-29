import AppError from "#helpers/app-error";
import { ALLOWED_PROFILE_FIELDS } from "#constants";
import {
  sanitizeGithubUsername,
  sanitizePlainText,
  sanitizeUrl,
} from "#helpers/sanitize";
import type {
  CreateProfileInput,
  UpdateProfileInput,
} from "@dev-conn/contracts";

/**
 * Validates experience/education date combinations that JSON Schema
 * cannot express (cross-field rules). Throws 400 instead of letting
 * `new Date()` produce `Invalid Date` cast errors (500s).
 */
export function validateDateRange(
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

/**
 * Normalises the owner into the `{ _id, name?, avatar? }` object the response
 * schemas declare. Handles both an already-populated subdocument and a bare
 * ObjectId or hex string, so a missed `populate` degrades to `{ _id }` instead
 * of serialising as an empty object.
 */
export function toOwner(
  value: unknown,
): { _id: string; name?: string; avatar?: string } | null {
  if (value && typeof value === "object" && "_id" in value) {
    const owner = value as { _id: unknown; name?: unknown; avatar?: unknown };
    return {
      _id: String(owner._id),
      ...(typeof owner.name === "string" && owner.name
        ? { name: owner.name }
        : {}),
      ...(typeof owner.avatar === "string" && owner.avatar
        ? { avatar: owner.avatar }
        : {}),
    };
  }
  // `populate` yields null when the referenced user is gone, and `String(null)`
  // is the literal "null" — which would become a link to /profiles/null.
  if (value === null || value === undefined) return null;
  return { _id: String(value) };
}

/** Reduces an ISO timestamp to the `YYYY-MM-DD` the contract promises. */
export function toDateOnly(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? value
      : parsed.toISOString().slice(0, 10);
  }
  return undefined;
}

/** Applies {@link toDateOnly} to the `from`/`to` of each subdocument. */
export function mapDates<T extends { from?: unknown; to?: unknown }>(
  entries: T[] | undefined,
): (Omit<T, "from" | "to"> & { from: string; to?: string })[] {
  return (entries ?? []).map((entry) => {
    const { from, to, ...rest } = entry;
    const fromDate = toDateOnly(from);
    const toDate = toDateOnly(to);
    return {
      ...rest,
      ...(fromDate !== undefined
        ? { from: fromDate }
        : ({} as { from: string })),
      ...(toDate !== undefined ? { to: toDate } : {}),
    };
  });
}

/**
 * Turns a create/update payload into a sanitised Mongo update document, shared
 * by the create, upsert and partial-update paths so all three sanitise alike.
 */
export function buildProfileUpdate(
  data: CreateProfileInput | UpdateProfileInput,
): {
  $set: Record<string, unknown>;
  $unset: Record<string, 1>;
} {
  const { facebook, instagram, linkedin, twitter, youtube, ...rest } = data;

  const toSet: Record<string, unknown> = {};
  const toUnset: Record<string, 1> = {};

  for (const [key, value] of Object.entries(rest)) {
    if (!ALLOWED_PROFILE_FIELDS.has(key)) continue;
    if (value === null || (typeof value === "string" && value.trim() === "")) {
      // `status`/`skills` are required: an empty value means "leave as is",
      // because unsetting them would violate the model.
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
    if (value === null || (typeof value === "string" && value.trim() === "")) {
      toUnset[`social.${key}`] = 1;
    } else if (value !== undefined) {
      const sanitized = sanitizeUrl(value as string | undefined | null);
      if (sanitized) toSet[`social.${key}`] = sanitized;
      else toUnset[`social.${key}`] = 1;
    }
  }

  return { $set: toSet, $unset: toUnset };
}
