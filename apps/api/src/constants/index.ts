/** Shared, immutable configuration values used across modules. */

export const GOOGLE_USERINFO_URL =
  "https://openidconnect.googleapis.com/v1/userinfo";

/** Profile fields a create/update payload is allowed to write. */
export const ALLOWED_PROFILE_FIELDS = new Set([
  "company",
  "website",
  "location",
  "status",
  "skills",
  "bio",
  "githubusername",
]);

/** How long a cached GitHub repos response stays fresh. */
export const GITHUB_CACHE_TTL_MS = 60_000 * 15;

/** Cap on cached GitHub repos responses before oldest-first eviction. */
export const GITHUB_CACHE_MAX_ENTRIES = 200;
