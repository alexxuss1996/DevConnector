# Posts + Profiles Pages — Design Spec

Date: 2026-10-02
Status: approved in chat (sections 1-5), pending file review
Approach: A — 2 client routes reusing hooks

## 1. Understanding

- Outcome: browse backend data (posts + profiles) from `apps/web`.
- Users: logged-in developers. Login required for all new pages.
- Success: login → see posts list, open detail, create/like/comment; see developers list, open detail.
- Constraints:
  - No CSS modules. Chakra props + `globals.css` only.
  - `@` alias for `src` imports.
  - Reuse existing layers: `packages/contracts` types, `apps/web/src/lib/api` clients, `apps/web/src/lib/queries` hooks, `apps/web/src/components/ui` primitives.
  - No new deps, no new contracts, no new API clients.

Assumptions (confirmed): full interactive scope; public-read deferred in favor of login-required guard; profiles read-only except own-profile edit deferred.

## 2. Architecture + Routes

- `src/app/(protected)/layout.tsx` — client guard component. Uses `useMyProfile()`. While loading renders `Skeleton`. On `ApiError` 401 does `router.replace('/login?next=' + pathname + search)`. No server auth check (cookies are httpOnly, RSC cannot read session cheaply; client guard is single path).
- `src/app/(protected)/posts/page.tsx` — single route file. List + create + detail. Detail driven by `?postId=` search param via nuqs (`useQueryState`). No separate `[id]` route — keeps "couple pages" at 2 top-level routes while preserving deep links + back button.
- `src/app/(protected)/developers/page.tsx` — same pattern. List via `useProfiles({page, limit})`. Detail via `?userId=` + `useProfileById({id})`, `enabled: !!userId`.
- `src/app/(auth)/login/page.tsx` — minimal prerequisite. `useLoginMutation()` + Chakra `Field`/`Input`/`PasswordInput`/`Button`. On success `router.replace(next ?? '/posts')`. No registration UI in scope (hooks exist, UI deferred).
- Pagination state via nuqs `?page=` (default 1, limit 12 for profiles, 20 for posts). Keeps URLs shareable; matches existing `NuqsAdapter` in `Provider`.

Files touched (new only, no edits to existing layers):
- `src/app/(protected)/layout.tsx`
- `src/app/(protected)/posts/page.tsx`
- `src/app/(protected)/developers/page.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/components/posts/PostComposer.tsx`
- `src/components/posts/PostCard.tsx`
- `src/components/posts/PostDetailDialog.tsx`
- `src/components/developers/ProfileCard.tsx`
- `src/components/developers/ProfileDetailDialog.tsx`

No changes to `lib/api/*`, `lib/queries/*`, `components/ui/*`, `contracts/*`.

## 3. Components + UI Reuse

Reuse only from `components/ui`: `Button`, `Field`, `Input`, `Textarea`, `Avatar`, `Tag`, `Skeleton`, `EmptyState`, `Pagination`, `Dialog`, `Toaster`, `PasswordInput`.

- `PostComposer`: `react-hook-form` (same pattern as `ExampleForm.tsx`), single `text` field (1-5000, non-blank per `CreatePostInput`), submit → `useCreatePostMutation()`, `Toaster` on error, clear on success (invalidation of `["posts"]` already wired).
- `PostCard`: props `{ post: Post }`. Shows text, like count, comment count. Actions: like/unlike toggle (`useLikePostMutation` / `useUnlikePostMutation`), delete (own posts only, `useDeletePostMutation`), click opens `?postId=`.
- `PostDetailDialog`: open when `?postId=` set. Reads `usePost({id})` + `usePostComments({id})`. Comments CRUD via `useAddCommentMutation`, `useUpdateCommentMutation`, `useDeleteCommentMutation`. Close clears param.
- `ProfileCard`: props `{ profile: PublicProfileSummary }`. `Avatar` + status + company + `Tag` skills. Click opens `?userId=`.
- `ProfileDetailDialog`: `useProfileById({id})`. Experience/education lists read-only. Own-profile edit explicitly out of scope (mutations exist, UI deferred).

Styling: Chakra style props inline. No CSS modules, no new theme tokens, no custom CSS files.

## 4. Data Flow

- URL (nuqs) is source of truth for `page`, `postId`, `userId`.
- Reads (React Query, `staleTime: 60s` from `Provider`):
  - `usePosts()` → `{ posts }` (note: current hook takes no pagination params; page param applies to profiles list; posts list renders full set with client slice if needed — no hook change in this spec).
  - `usePost({id}, {enabled})`, `usePostComments({id}, {enabled})`.
  - `useProfiles({page, limit})` → `{ profiles, total, page, limit }`.
  - `useProfileById({id}, {enabled})`.
  - `useMyProfile()` for guard only.
- Writes: all mutations already invalidate correct keys (`["posts"]`, `["post", id]`, `["profile"]`, `["profiles"]`). No optimistic updates, no manual cache writes.
- Guard flow: `(protected)/layout.tsx` → `useMyProfile` loading → skeleton; 401 → `/login?next=`; success → render children. Login page reads `next` via nuqs, `router.replace` after `mutateAsync` success.
- Imports via `@/...` alias throughout.

## 5. Error Handling

- `ApiError` only. No new error classes.
- 401 in guard → redirect. 401 elsewhere (expired session) → `Toaster` + redirect to login via same `next` mechanism.
- 404 detail (`usePost` / `useProfileById` error with status 404) → `EmptyState` inside dialog + close button.
- Other errors → `Toaster` with `err.message`, description includes `requestId` when backend provides it.
- Loading: `Skeleton` for lists and dialog content. No spinners.
- Root `error.tsx` + `loading.tsx` unchanged; cover route-level crashes.

## 6. Testing

- Vitest (`src/**/*.test.tsx`, jsdom docblock per file, `@` alias already configured):
  - guard redirects on 401 from `useMyProfile`.
  - `?postId=` opens detail dialog, `?userId=` opens profile dialog.
  - composer submits via `useCreatePostMutation`.
  - like/unlike invalidates `["post", id]` (same mock style as `src/lib/queries/index.test.ts`: mock `@tanstack/react-query`, assert `invalidateQueries`).
- 1 Playwright smoke (existing `playwright.config.ts`): login → posts list renders → open detail → add comment appears.
- No new test infra. No Storybook stories in scope.

## 7. Out of Scope

- Registration UI, password reset, Google link.
- Own-profile create/update, add/delete experience/education UI (hooks exist, UI deferred).
- Public/SEO pages, RSC prefetch, optimistic updates.
- New contracts, new API clients, new UI primitives, new deps.
- CSS modules, custom theme, dark-mode specifics beyond existing `ColorModeProvider`.

## 8. Next.js Version Note

Per `apps/web/AGENTS.md`, implementation must read the relevant guide in `node_modules/next/dist/docs/` (resolved from `apps/web`) before writing code and heed deprecations. Spec assumes App Router conventions as observed (`src/app/layout.tsx`, `page.tsx`); if docs show breaking changes to routing/layouts/metadata, plan must adapt before code.
