# API & Queries — Frontend Usage Guide

## Overview

The frontend communicates with the backend via a layered API client in `apps/web/lib/api/`. All request/response types are driven by the shared contracts package (`@dev-conn/contracts`), which is a TypeBox schema library consumed by both the Fastify backend (for validation) and the React frontend (for types).

## Architecture

```
packages/contracts/src/     → TypeBox schemas + extracted TS types (single source of truth)
apps/api/src/routes/        → Fastify route handlers, validate with contract schemas
apps/web/lib/api/           → Frontend HTTP clients (ApiClient + resource clients)
apps/web/lib/queries/       → React Query hooks wrapping the API clients
```

## HTTP Client (`lib/api/client.ts`)

**`ApiClient`** — base class wrapping `fetch` with cookie-based session auth:

- Constructor takes a `baseUrl` (default: `NEXT_PUBLIC_API_URL` env var, falls back to `http://localhost:4000`).
- All requests include `credentials: "include"` for cookie transport.
- `Content-Type: application/json` is set automatically.
- Non-2xx responses throw **`ApiError`** with `{ status, code, message }` — the `code` comes from the backend error body.
- 204 responses return `undefined`.
- JSON responses are parsed and typecast to `T`.

**`apiFetch<T>(path, init)`** — legacy convenience wrapper that delegates to the shared `apiClient`. Prefer `ApiClient`/`apiClient` directly for new code.

**`toQuery(params: PaginationParams)`** — builds a `?page=N&limit=N` query string, omitting unset params. Used by collection endpoints.

**`PaginationParams`**: `{ page?: number; limit?: number }`.

### Usage

```ts
import { apiClient, ApiError } from "@/lib/api";

try {
  const data = await apiClient.get<{ posts: Post[] }>("/posts/?page=1&limit=20");
} catch (err) {
  if (err instanceof ApiError) {
    // err.status, err.code, err.message
  }
}
```

## Resource Clients

Each resource has a dedicated client class extending `ApiClient`, with a shared singleton instance.

### Auth (`lib/api/auth.ts`)

| Method | HTTP | Path | Body | Returns |
|---|---|---|---|---|
| `register(data)` | POST | `/auth/register` | `RegisterUserInput` | `AuthUser` |
| `login(data)` | POST | `/auth/login` | `LoginUserInput` | `AuthUser` |
| `logout()` | POST | `/auth/logout` | — | `void` (204) |
| `refresh()` | POST | `/auth/refresh` | — | `AuthUser` |

**`authApi`** — shared instance.

```ts
import { authApi } from "@/lib/api/auth";

const user = await authApi.login({ email: "x@y.com", password: "pass" });
// Cookies (access_token, refresh_token) set automatically by backend.
```

### Posts (`lib/api/posts.ts`)

| Method | HTTP | Path | Body/Params | Returns |
|---|---|---|---|---|
| `getPosts(params)` | GET | `/posts/?page=N&limit=N` | `PaginationParams` | `{ posts: Post[] }` |
| `getPost(params)` | GET | `/posts/:id` | `PostIdParams` | `{ post: Post }` |
| `getPostComments(params)` | GET | `/posts/:id/comments` | `PostIdParams` | `{ comments: Comment[] }` |
| `createPost(data)` | POST | `/posts/` | `CreatePostInput` | `Post` |
| `deletePost(params)` | DELETE | `/posts/:id` | `PostIdParams` | `void` (204) |
| `addComment(params, data)` | POST | `/posts/:id/comments` | `PostIdParams` + `CreatePostCommentInput` | `Comment[]` |
| `updateComment(params, data)` | PUT | `/posts/:id/comments/:commentId` | `PostCommentIdParams` + `UpdatePostCommentInput` | `Comment` |
| `deleteComment(params)` | DELETE | `/posts/:id/comments/:commentId` | `PostCommentIdParams` | `void` (204) |
| `likePost(params)` | PUT | `/posts/:id/like` | `PostIdParams` | `void` (204) |
| `unlikePost(params)` | PUT | `/posts/:id/unlike` | `PostIdParams` | `void` (204) |

**`postsApi`** — shared instance.

```ts
import { postsApi } from "@/lib/api/posts";

const { posts } = await postsApi.getPosts({ page: 1, limit: 20 });
const { post } = await postsApi.getPost({ id: "6712..." });
await postsApi.createPost({ text: "Hello world" });
```

### Profile (`lib/api/profile.ts`)

| Method | HTTP | Path | Body/Params | Returns |
|---|---|---|---|---|
| `createOrUpdateProfile(data)` | POST | `/profile/` | `CreateProfileInput` | `{ profile: Profile }` |
| `updateProfile(data)` | PUT | `/profile/` | `UpdateProfileInput` | `{ profile: Profile }` |
| `getProfiles(params)` | GET | `/profile/?page=N&limit=N` | `PaginationParams` | `{ profiles: Profile[] }` |
| `getMyProfile()` | GET | `/profile/me` | — | `{ profile: Profile }` |
| `getProfileById(params)` | GET | `/profile/user/:id` | `ProfileIdParams` | `{ profile: Profile }` |
| `getGithubRepos(params)` | GET | `/profile/github/:username` | `GithubUsernameParams` | `unknown` (GitHub API response) |
| `addExperience(data)` | POST | `/profile/experience` | `AddExperienceInput` | `{ profile: Profile }` |
| `deleteExperience(params)` | DELETE | `/profile/experience/:experienceId` | `ExperienceIdParams` | `{ profile: Profile }` |
| `addEducation(data)` | POST | `/profile/education` | `AddEducationInput` | `{ profile: Profile }` |
| `deleteEducation(params)` | DELETE | `/profile/education/:educationId` | `EducationIdParams` | `{ profile: Profile }` |
| `deleteProfile()` | DELETE | `/profile/` | — | `void` (204) |

**`profileApi`** — shared instance.

```ts
import { profileApi } from "@/lib/api/profile";

const { profile } = await profileApi.getMyProfile();
await profileApi.addExperience({ title: "Dev", company: "Acme", from: "2022-01-01" });
```

## React Query Hooks (`lib/queries/index.ts`)

All hooks wrap the resource API clients with TanStack React Query. They handle query keys, caching, and cache invalidation on mutations.

### Auth

| Hook | Type | Query Key | On Success |
|---|---|---|---|
| `useRegisterMutation()` | `UseMutation` | — | — |
| `useLoginMutation()` | `UseMutation` | — | — |
| `useLogoutMutation()` | `UseMutation` | — | `queryClient.clear()` |

> `useRefreshMutation` is not exposed as a React Query hook. Use `authApi.refresh()` directly if you need it.

```ts
const login = useLoginMutation();
await login.mutateAsync({ email: "x@y.com", password: "pass" });
```

### Profile

| Hook | Type | Query Key | On Success |
|---|---|---|---|
| `useProfiles(options?)` | `UseQuery` | `["profiles"]` | — |
| `useMyProfile(options?)` | `UseQuery` | `["profile", "me"]` | — |
| `useProfileById(params, options?)` | `UseQuery` | `["profile", params.id]` | — |
| `useCreateProfileMutation()` | `UseMutation` | — | invalidate `["profile"]`, `["profiles"]` |
| `useUpdateProfileMutation()` | `UseMutation` | — | invalidate `["profile"]`, `["profiles"]` |
| `useAddExperienceMutation()` | `UseMutation` | — | invalidate `["profile"]` |
| `useDeleteExperienceMutation()` | `UseMutation` | — | invalidate `["profile"]` |
| `useAddEducationMutation()` | `UseMutation` | — | invalidate `["profile"]` |
| `useDeleteEducationMutation()` | `UseMutation` | — | invalidate `["profile"]` |

```ts
const { data, isLoading } = useProfiles();
const { data } = useProfileById({ id: "6712..." });
const createProfile = useCreateProfileMutation();
```

### Posts

| Hook | Type | Query Key | On Success |
|---|---|---|---|
| `usePosts(options?)` | `UseQuery` | `["posts"]` | — |
| `usePost(params, options?)` | `UseQuery` | `["post", params.id]` | — |
| `usePostComments(params, options?)` | `UseQuery` | `["post", params.id, "comments"]` | — |
| `useCreatePostMutation()` | `UseMutation` | — | invalidate `["posts"]` |
| `useDeletePostMutation()` | `UseMutation` | — | invalidate `["posts"]` |
| `useAddCommentMutation()` | `UseMutation` | — | invalidate `["post", vars.params.id]` |
| `useUpdateCommentMutation()` | `UseMutation` | — | invalidate `["post", vars.params.id]` |
| `useDeleteCommentMutation()` | `UseMutation` | — | invalidate `["post", vars.id]` |
| `useLikePostMutation()` | `UseMutation` | — | invalidate `["post", vars.id]` |
| `useUnlikePostMutation()` | `UseMutation` | — | invalidate `["post", vars.id]` |

```ts
const { data } = usePost({ id: "6712..." });
const addComment = useAddCommentMutation();
addComment.mutateAsync({ params: { id: "6712..." }, data: { text: "Nice post" } });
```

### Generic options

All `UseQuery` hooks accept an optional second argument that omits `queryKey` and `queryFn` — you can pass any other `UseQueryOptions` override (e.g. `enabled`, `refetchInterval`, `select`, `staleTime`):

```ts
const { data } = usePosts({ staleTime: 1000 * 60, select: (d) => d.posts.slice(0, 5) });
```

## Contracts Package (`@dev-conn/contracts`)

The contracts package is the shared type/schema boundary. It uses **TypeBox** to define JSON schemas that both the backend (Fastify + `@fastify/type-provider-typebox`) and frontend (TypeScript types via `Static<typeof Schema>`) consume.

### Exported schemas and types

**Auth** (`contracts/src/auth.ts`):
- `RegisterUserSchema` → `RegisterUserInput` — `{ name, email, password }`
- `LoginUserSchema` → `LoginUserInput` — `{ email, password }`
- `CompleteOnboardingSchema` → `CompleteOnboardingInput` — `{ name }`
- `LinkGoogleSchema` → `LinkGoogleInput` — `{ accessToken }`
- `AuthUserSchema` → `AuthUser` — `{ id, name?, email, avatar? }`

**Posts** (`contracts/src/posts.ts`):
- `CreatePostSchema` → `CreatePostInput` — `{ text: string (1-5000, non-blank) }`
- `CreatePostCommentSchema` → `CreatePostCommentInput` — `{ text: string (1-1000, non-blank) }`
- `UpdatePostCommentSchema` → `UpdatePostCommentInput` — `{ text: string (1-1000, non-blank) }`
- `PostIdParamsSchema` → `PostIdParams` — `{ id: ObjectId string }`
- `PostCommentIdParamsSchema` → `PostCommentIdParams` — `{ id: ObjectId, commentId: ObjectId }`

**Profile** (`contracts/src/profile.ts`):
- `CreateProfileSchema` → `CreateProfileInput` — full profile payload (company, website, location, status, skills, bio, githubusername, social URLs)
- `UpdateProfileSchema` → `UpdateProfileInput` — partial profile
- `AddExperienceSchema` → `AddExperienceInput` — `{ title, company, location?, from, to?, current?, description? }`
- `AddEducationSchema` → `AddEducationInput` — `{ school, degree, fieldofstudy, from, to?, current?, description? }`
- `ProfileIdParamsSchema` → `ProfileIdParams` — `{ id: ObjectId }`
- `GithubUsernameParamsSchema` → `GithubUsernameParams` — `{ username: string (1-39, alphanumeric-hyphen) }`
- `ExperienceIdParamsSchema` → `ExperienceIdParams` — `{ experienceId: ObjectId }`
- `EducationIdParamsSchema` → `EducationIdParams` — `{ educationId: ObjectId }`

### Adding a new endpoint

1. Define the TypeBox schema in the appropriate file under `packages/contracts/src/`.
2. Export both the schema const and the extracted type (`export type FooInput = Static<typeof FooSchema>`).
3. Import the schema in the backend route handler and pass it as `schema: { body: FooSchema }` (or `params`, `querystring`).
4. Import the type in the frontend API client and use it as the method signature.
5. Add a React Query hook in `lib/queries/index.ts` if the endpoint is read-oriented or needs cache invalidation.

---

*Last verified: the frontend API surface matches the backend routes; all 24 endpoints have a corresponding frontend method. See `apps/web/lib/api/README.md` for the full client reference.*
