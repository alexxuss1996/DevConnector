import { GITHUB_CACHE_MAX_ENTRIES, GITHUB_CACHE_TTL_MS } from "#constants";

const githubReposCache = new Map<
  string,
  { expiresAt: number; data: unknown }
>();

/** Returns the cached payload for `key`, or undefined when absent or expired. */
export function getCachedGithubRepos(key: string): unknown | undefined {
  const entry = githubReposCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    githubReposCache.delete(key);
    return undefined;
  }
  return entry.data;
}

/** Caches `data` under `key` for {@link GITHUB_CACHE_TTL_MS}. */
export function setCachedGithubRepos(key: string, data: unknown): void {
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
