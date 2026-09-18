# Frontend API clients

Type-safe clients for the DevConnector Fastify API (`apps/api`). Cookie-session
auth is used throughout: the browser sends `access_token` / `refresh_token`
cookies automatically (`credentials: "include"`), so no token handling is needed
in components.

## Quick start

Use the shared singletons in components, hooks, and server actions:

```ts
import { authApi } from "@/lib/api/auth";
import { profileApi } from "@/lib/api/profile";
import { postsApi } from "@/lib/api/posts";

const user = await authApi.login({ email, password });
const { profile } = await profileApi.getMyProfile();
const { posts } = await postsApi.getPosts({ page: 1, limit: 20 });
```

Prefer the React Query hooks in `@/lib/queries` for data fetching inside
components — they wrap these clients with caching and invalidation:

```tsx
import { useMyProfile, useCreatePostMutation } from "@/lib/queries";

const { data, isLoading, error } = useMyProfile();
const createPost = useCreatePostMutation();
createPost.mutate({ text: "Hello world" });
```

## The base client

`ApiClient` (`client.ts`) owns the `fetch` plumbing: base URL, JSON
serialization, `credentials: "include"`, and error mapping. All resource
clients extend it.

```ts
import { ApiClient, apiClient, ApiError } from "@/lib/api/client";

// Custom endpoint (staging, tests, SSR against internal host, …)
const staging = new ApiClient("https://staging-api.example.com");
```

`NEXT_PUBLIC_API_URL` sets the default base URL (falls back to
`http://localhost:4000`).

### `ApiError`

Non-2xx responses throw `ApiError`, which carries the backend's stable error
code alongside the HTTP status:

```ts
import { ApiError } from "@/lib/api/client";

try {
  await profileApi.getMyProfile();
} catch (err) {
  if (err instanceof ApiError) {
    if (err.code === "PROFILE_NOT_FOUND") showOnboarding();
    else if (err.code === "VALIDATION_ERROR") showFormErrors(err.message);
    else if (err.status === 401) redirectToLogin();
  }
}
```

Common codes: `VALIDATION_ERROR`, `FAILED_AUTHENTICATION`,
`INVALID_CREDENTIALS`, `PROFILE_NOT_FOUND`, `POST_NOT_FOUND`,
`COMMENT_NOT_FOUND`, `FORBIDDEN`, `RATE_LIMIT_EXCEEDED`,
`INTERNAL_SERVER_ERROR`. HTTP 204 responses resolve to `undefined`
(typed as `Promise<void>`).

## Resource clients

### `AuthApiClient` (`auth.ts`, singleton `authApi`)

| Method              | Endpoint         | Returns     |
| ------------------- | ---------------- | ----------- |
| `register(data)`    | `POST /auth/register` | `AuthUser` |
| `login(data)`       | `POST /auth/login`    | `AuthUser` |
| `logout()`          | `POST /auth/logout`   | `void` (always clears cookies, even for expired sessions) |
| `refresh()`         | `POST /auth/refresh`  | `AuthUser` (rotates the session) |

Request bodies use `@dev-conn/contracts` types (`RegisterUserInput`,
`LoginUserInput`), so validation rules stay in sync with the backend.

Google OAuth is browser-redirect based, not a client method: send the user to
`<API_URL>/auth/google`, the API redirects back to `FRONTEND_URL` on success
or to `FRONTEND_URL?error=google_auth_failed` on failure.

### `ProfileApiClient` (`profile.ts`, singleton `profileApi`)

Every profile endpoint returns the `{ profile }` envelope (lists return
`{ profiles }`):

```ts
const { profile } = await profileApi.createOrUpdateProfile({
  status: "Developer",
  skills: ["TypeScript"],
});
await profileApi.addExperience({ title: "Dev", company: "Acme", from: "2023-01-01" });
await profileApi.deleteProfile(); // deletes profile + user, resolves void
```

| Method | Returns |
| ------ | ------- |
| `createOrUpdateProfile(data)` | `{ profile: Profile }` |
| `getProfiles({ page, limit }?)` | `{ profiles: Profile[] }` |
| `getMyProfile()` | `{ profile: Profile }` |
| `getProfileById({ id })` | `{ profile: Profile }` |
| `getGithubRepos({ username })` | `unknown` (raw GitHub payload) |
| `addExperience(data)` / `addEducation(data)` | `{ profile: Profile }` |
| `deleteExperience({ experienceId })` / `deleteEducation({ educationId })` | `{ profile: Profile }` |
| `deleteProfile()` | `void` |

### `PostsApiClient` (`posts.ts`, singleton `postsApi`)

Reads are enveloped (`{ post }`, `{ posts }`, `{ comments }`); mutations return
the bare resource, and 204 actions resolve `void`:

```ts
const { posts } = await postsApi.getPosts({ page: 2, limit: 10 });
const post = await postsApi.createPost({ text: "Hello" });
await postsApi.likePost({ id: post._id });
const comments = await postsApi.addComment({ id: post._id }, { text: "Nice!" });
```

| Method | Returns |
| ------ | ------- |
| `getPosts({ page, limit }?)` | `{ posts: Post[] }` |
| `getPost({ id })` | `{ post: Post }` |
| `getPostComments({ id })` | `{ comments: Post["comments"] }` |
| `createPost(data)` | `Post` |
| `deletePost({ id })` | `void` |
| `addComment({ id }, data)` | `Post["comments"]` |
| `updateComment({ id, commentId }, data)` | `Post["comments"][number]` |
| `deleteComment({ id, commentId })` | `void` |
| `likePost({ id })` / `unlikePost({ id })` | `void` |

## Conventions

- **Params are objects** (`{ id }`, `{ page, limit }`), matching the backend's
  TypeBox schemas — pass contract types straight through.
- **IDs are 24-hex strings**; the API rejects anything else with
  `VALIDATION_ERROR`. Prefer the `*Params` contract types for safety.
- **Pagination** is optional (`{ page, limit }`, limit capped at 100 server-side);
  omitting it returns the first page.
- **`Profile` / `Post` response types** are declared in `profile.ts` / `posts.ts`
  (the `contracts` package covers request shapes; responses stay local until a
  shared response contract lands).
- The legacy `apiFetch(path, init)` helper still exists in `client.ts` as a thin
  wrapper around the shared `apiClient` — use the resource clients for new code.

## Testing

Instantiate a client against a throwaway base URL and stub `global.fetch`:

```ts
import { PostsApiClient } from "@/lib/api/posts";

const client = new PostsApiClient("http://test");
global.fetch = async () =>
  new Response(JSON.stringify({ posts: [] }), { status: 200 });

const { posts } = await client.getPosts();
```
