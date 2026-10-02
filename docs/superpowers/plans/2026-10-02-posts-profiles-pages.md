# Posts + Profiles Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add login-required `/posts` and `/developers` pages with list + detail + mutations to `apps/web`.

**Architecture:** Two client routes under `(protected)` reusing existing `ApiClient` resource clients and React Query hooks; URL search params via nuqs drive pagination and detail dialogs; client guard redirects 401 to `/login?next=`.

**Tech Stack:** Next.js 16 App Router, React 19, Chakra UI v3, TanStack React Query v5, nuqs, react-hook-form, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-02-posts-profiles-pages-design.md`

## Global Constraints

- Login required for all new pages; 401 redirects to `/login?next=<pathname+search>`.
- No CSS modules; Chakra style props + `globals.css` only.
- All frontend imports via `@` alias for `src`.
- Reuse only: `packages/contracts` types, `apps/web/src/lib/api/*` clients, `apps/web/src/lib/queries/*` hooks, `apps/web/src/components/ui/*` primitives.
- No new deps, no new contracts, no new API clients, no new `components/ui` primitives.
- `react-hook-form` for forms, same pattern as `src/components/forms/ExampleForm.tsx`.
- Before writing any route/layout code, read `apps/web/node_modules/next/dist/docs/01-app/` getting-started + routing guides and heed deprecations (per `apps/web/AGENTS.md`).

## Review Focus

- Expired session mid-mutation returns 401 after refresh fails → user sees login redirect preserving `next`, not a stuck spinner. (Task 1 test.)
- `?postId=` holds a non-ObjectId string (hand-edited URL) → detail dialog shows EmptyState, never calls `usePost` with invalid id (enabled-gated). (Task 3 test.)
- `?userId=` holds unknown-but-valid ObjectId → profile dialog shows EmptyState on 404. (Task 4 test.)
- Comment composer submits blank/whitespace text → client-side validation blocks submit, no API call. (Task 3 test.)
- Profiles list with `total: 0` → EmptyState renders, pagination hidden. (Task 4 test.)

---

### Task 1: Auth foundation (login page + protected guard)

**Files:**
- Create: `apps/web/src/app/(auth)/login/page.tsx`
- Create: `apps/web/src/app/(protected)/layout.tsx`
- Test: `apps/web/src/app/(protected)/layout.test.tsx`
- Test: `apps/web/src/app/(auth)/login/page.test.tsx`

**Interfaces:**
- Consumes: `useMyProfile()` from `@/lib/queries`, `useLoginMutation()` from `@/lib/queries`, `ApiError` from `@/lib/api/client`, `LoginUserInput` from `@dev-conn/contracts`.
- Produces: `ProtectedLayout({ children: React.ReactNode })` (client component); `LoginPage()` (client component reading `next` via nuqs `useQueryState("next", { defaultValue: "/posts" })`).

- [ ] **Step 1: Write failing guard test in `apps/web/src/app/(protected)/layout.test.tsx`**

```tsx
/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
// mock @tanstack/react-query useMyProfile via @/lib/queries is complex;
// mock the queries module: loading -> Skeleton, 401 ApiError -> router.replace("/login?next=..."), success -> children.
describe("ProtectedLayout", () => {
  it("redirects to login with next on 401", () => {});
  it("renders children on success", () => {});
});
```

Concrete assertions (fill bodies): 401 case expects `router.replace` called with string starting `/login?next=`; success case expects `getByTestId("protected-children")` in document.

- [ ] **Step 2: Run guard test, verify it fails**

Run: `pnpm --filter web exec vitest run src/app/\(protected\)/layout.test.tsx`
Expected: FAIL with "No test file found" or assertion failure (file under construction).

- [ ] **Step 3: Implement `ProtectedLayout` in `apps/web/src/app/(protected)/layout.tsx`**

Signature: `export default function ProtectedLayout({ children }: { children: React.ReactNode })`. Client component (`"use client"`). Uses `useMyProfile()`; loading → `<Skeleton />`; `ApiError` status 401 → `useRouter().replace('/login?next=' + encodeURIComponent(pathname + search))` via `usePathname()` + `useSearchParams()`; success → `children`.

- [ ] **Step 4: Write failing login test in `apps/web/src/app/(auth)/login/page.test.tsx`**

```tsx
/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
describe("LoginPage", () => {
  it("submits email+password via useLoginMutation and redirects to next", () => {});
});
```

Concrete: render with mocked `useLoginMutation` (`mutateAsync` resolves `{ user: { id: "6712abcd1234abcd1234abcd", email: "x@y.com" }, accessToken: "a", refreshToken: "r" }`), fill `you@example.com` / `password123`, submit, expect `mutateAsync` called with `{ email: "you@example.com", password: "password123" }` and `router.replace("/posts")`.

- [ ] **Step 5: Run login test, verify it fails**

Run: `pnpm --filter web exec vitest run "src/app/(auth)/login/page.test.tsx"`
Expected: FAIL (file missing).

- [ ] **Step 6: Implement `LoginPage` in `apps/web/src/app/(auth)/login/page.tsx`**

Signature: `export default function LoginPage()`. Client component. `react-hook-form` with `email` + `password` fields (Chakra `Field`, `Input`, `PasswordInput`, `Button`), `next` from nuqs, `useLoginMutation().mutateAsync`, `toaster` error on `ApiError` including `requestId` when present, `router.replace(next)` on success.

- [ ] **Step 7: Run Task 1 tests, verify pass**

Run: `pnpm --filter web exec vitest run "src/app/(protected)/layout.test.tsx" "src/app/(auth)/login/page.test.tsx"`
Expected: PASS (all tests).

- [ ] **Step 8: Run types + lint for Task 1**

Run: `pnpm --filter web exec tsc --noEmit` then `pnpm --filter web exec eslint --max-warnings 0 "src/app/(protected)/layout.tsx" "src/app/(auth)/login/page.tsx"`
Expected: clean, no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/\(protected\)/layout.tsx "apps/web/src/app/(protected)/layout.test.tsx" "apps/web/src/app/(auth)/login/page.tsx" "apps/web/src/app/(auth)/login/page.test.tsx"
git commit -m "feat(web): login page and protected guard"
```

### Task 2: Posts list + create + like/unlike/delete

**Files:**
- Create: `apps/web/src/components/posts/PostComposer.tsx`
- Create: `apps/web/src/components/posts/PostCard.tsx`
- Create: `apps/web/src/app/(protected)/posts/page.tsx`
- Test: `apps/web/src/components/posts/PostComposer.test.tsx`
- Test: `apps/web/src/components/posts/PostCard.test.tsx`

**Interfaces:**
- Consumes: `usePosts()`, `useCreatePostMutation()`, `useLikePostMutation()`, `useUnlikePostMutation()`, `useDeletePostMutation()` from `@/lib/queries`; `Post` from `@dev-conn/contracts`; Task 1 guard (no import, route placement under `(protected)`).
- Produces: `PostComposer({ onCreated?: () => void })`; `PostCard({ post: Post; onOpen: (id: string) => void })`; `PostsPage()` reading `page` via nuqs.

- [ ] **Step 1: Write failing composer test**

```tsx
/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
describe("PostComposer", () => {
  it("submits text via useCreatePostMutation and clears", async () => {});
});
```

Concrete: mock `useCreatePostMutation` returning `{ mutateAsync: vi.fn().mockResolvedValue({ _id: "6712abcd1234abcd1234abcd" }) }`; type `"Hello world"`; submit; expect `mutateAsync` called with `{ text: "Hello world" }`.

- [ ] **Step 2: Run composer test, verify FAIL**

Run: `pnpm --filter web exec vitest run src/components/posts/PostComposer.test.tsx`
Expected: FAIL (missing component).

- [ ] **Step 3: Implement `PostComposer({ onCreated }: { onCreated?: () => void })`**

`react-hook-form` single `text` field, Chakra `Textarea` + `Button`, validation `minLength 1 / maxLength 5000 / non-blank`, submit → `useCreatePostMutation().mutateAsync({ text })`, error → `toaster` with `ApiError.message` + `requestId`, success → `reset()` + `onCreated?.()`.

- [ ] **Step 4: Write failing card test**

```tsx
/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
describe("PostCard", () => {
  it("toggles like via like/unlike mutations", async () => {});
  it("opens detail on click", async () => {});
});
```

Fixture `Post`: `{ _id: "6712abcd1234abcd1234abcd", userId: { _id: "6712abcd1234abcd1234abce", name: "Alex" }, text: "Hi", likes: [], comments: [] }`. Liked variant has `likes: [{ userId: "me" }]`. Expect `likePost` called with `{ id: post._id }` when unliked; `onOpen` called with `post._id` on title click.

- [ ] **Step 5: Run card test, verify FAIL**

Run: `pnpm --filter web exec vitest run src/components/posts/PostCard.test.tsx`
Expected: FAIL.

- [ ] **Step 6: Implement `PostCard({ post, onOpen }: { post: Post; onOpen: (id: string) => void })`**

Chakra card: text, `likes.length`, `comments.length`, like/unlike toggle button, delete button (render only when `post.userId._id === myId` — get `myId` from `useMyProfile().data?.profile.userId._id`, hide button otherwise), click title → `onOpen(post._id)`.

- [ ] **Step 7: Implement `PostsPage()` in `apps/web/src/app/(protected)/posts/page.tsx`**

Client component. `const [page, setPage] = useQueryState("page", { defaultValue: 1, parse: Number })`; `const [postId, setPostId] = useQueryState("postId", { defaultValue: "" })`. `usePosts()` list (no pagination params — hook takes none), render `PostComposer` + `PostCard` list + `Skeleton` loading + `EmptyState` when `posts.length === 0`. `onOpen={setPostId}`. Render `<PostDetailDialog postId={postId} onClose={() => setPostId("")} />` (built in Task 3; import it here — Task 3 test doubles as integration check).

- [ ] **Step 8: Run Task 2 tests**

Run: `pnpm --filter web exec vitest run src/components/posts/`
Expected: PASS.

- [ ] **Step 9: Types + lint, commit**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: PASS.

```bash
git add apps/web/src/components/posts/ "apps/web/src/app/(protected)/posts/page.tsx"
git commit -m "feat(web): posts list with create like delete"
```

### Task 3: Post detail dialog + comments CRUD

**Files:**
- Create: `apps/web/src/components/posts/PostDetailDialog.tsx`
- Test: `apps/web/src/components/posts/PostDetailDialog.test.tsx`

**Interfaces:**
- Consumes: `usePost({id}, {enabled})`, `usePostComments({id}, {enabled})`, `useAddCommentMutation()`, `useUpdateCommentMutation()`, `useDeleteCommentMutation()` from `@/lib/queries`; `PostCommentIdParams` from `@dev-conn/contracts`; `PostCard` owner id (no import).
- Produces: `PostDetailDialog({ postId: string; onClose: () => void })`.

- [ ] **Step 1: Write failing dialog tests**

```tsx
/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
describe("PostDetailDialog", () => {
  it("shows EmptyState for non-ObjectId postId without fetching", () => {});
  it("adds a comment via useAddCommentMutation", () => {});
  it("blocks blank comment submit without API call", () => {});
});
```

Concrete: `postId="not-an-id"` → expect `EmptyState` text, `usePost` mock not called (assert via mocked queries module `queryFn` not invoked). Valid id `"6712abcd1234abcd1234abcd"` with comments `[{ _id: "6723abcd1234abcd1234abcd", userId: "6712abcd1234abcd1234abce", text: "Nice", name: "Sam" }]` → add `"Great post"` expects `mutateAsync` with `{ params: { id }, data: { text: "Great post" } }`. Blank `"   "` → `mutateAsync` not called.

- [ ] **Step 2: Run dialog test, verify FAIL**

Run: `pnpm --filter web exec vitest run src/components/posts/PostDetailDialog.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `PostDetailDialog({ postId, onClose }: { postId: string; onClose: () => void })`**

Chakra `Dialog`. `const isValidId = /^[0-9a-fA-F]{24}$/.test(postId)`. `usePost({ id: postId }, { enabled: isValidId })`, `usePostComments({ id: postId }, { enabled: isValidId })`. Invalid → `EmptyState` + close. Loading → `Skeleton`. 404 `ApiError` → `EmptyState`. Comments list with edit (own only) via `useUpdateCommentMutation`, delete via `useDeleteCommentMutation` (`{ id: postId, commentId }`), add via `useAddCommentMutation` with non-blank guard. Errors → `toaster` with `requestId`.

- [ ] **Step 4: Run Task 3 tests**

Run: `pnpm --filter web exec vitest run src/components/posts/PostDetailDialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/posts/PostDetailDialog.tsx apps/web/src/components/posts/PostDetailDialog.test.tsx
git commit -m "feat(web): post detail dialog with comments"
```

### Task 4: Developers list + profile detail

**Files:**
- Create: `apps/web/src/components/developers/ProfileCard.tsx`
- Create: `apps/web/src/components/developers/ProfileDetailDialog.tsx`
- Create: `apps/web/src/app/(protected)/developers/page.tsx`
- Test: `apps/web/src/components/developers/ProfileCard.test.tsx`
- Test: `apps/web/src/components/developers/ProfileDetailDialog.test.tsx`

**Interfaces:**
- Consumes: `useProfiles({page, limit})`, `useProfileById({id}, {enabled})` from `@/lib/queries`; `PublicProfileSummary`, `PublicProfile` from `@dev-conn/contracts`.
- Produces: `ProfileCard({ profile: PublicProfileSummary; onOpen: (id: string) => void })`; `ProfileDetailDialog({ userId: string; onClose: () => void })`; `DevelopersPage()`.

- [ ] **Step 1: Write failing card + empty-list tests**

```tsx
/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
describe("ProfileCard", () => {
  it("opens detail with user id on click", () => {});
});
describe("DevelopersPage empty", () => {
  it("hides pagination and shows EmptyState when total is 0", () => {});
});
```

Fixture summary: `{ _id: "6712abcd1234abcd1234abcd", userId: { _id: "6712abcd1234abcd1234abce", name: "Alex" }, status: "Developer", skills: ["React"] }`. Expect `onOpen` called with `"6712abcd1234abcd1234abce"` (the `userId._id`, not `_id` — detail API is `/profiles/user/:id`). Empty: mocked `useProfiles` returns `{ profiles: [], total: 0, page: 1, limit: 12 }` → `EmptyState` visible, pagination query absent.

- [ ] **Step 2: Run tests, verify FAIL**

Run: `pnpm --filter web exec vitest run src/components/developers/`
Expected: FAIL (files missing).

- [ ] **Step 3: Implement `ProfileCard` + `ProfileDetailDialog`**

`ProfileCard({ profile, onOpen })`: Chakra + `Avatar` (name), status, company/location, `Tag` per skill, click → `onOpen(profile.userId._id)`.
`ProfileDetailDialog({ userId, onClose })`: `isValidId` regex gate, `useProfileById({ id: userId }, { enabled: isValidId && userId !== "" })`, invalid → `EmptyState`, 404 → `EmptyState`, loading → `Skeleton`, success → experience/education read-only lists (no edit UI per spec).

- [ ] **Step 4: Implement `DevelopersPage()` in `apps/web/src/app/(protected)/developers/page.tsx`**

Client component. nuqs `page` (default 1) + `userId` (default `""`), `limit = 12`. `useProfiles({ page, limit })`. List `ProfileCard`, `Skeleton` loading, `EmptyState` + hidden pagination when `total === 0`, Chakra `PaginationRoot` (`count={total}`, `pageSize={limit}`, `onPageChange={setPage}`, `getHref` unset — button type). Detail: `<ProfileDetailDialog userId={userId} onClose={() => setUserId("")} />`.

- [ ] **Step 5: Run Task 4 tests**

Run: `pnpm --filter web exec vitest run src/components/developers/ "src/app/(protected)/developers"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/developers/ "apps/web/src/app/(protected)/developers/page.tsx"
git commit -m "feat(web): developers list with profile detail"
```

### Task 5: Pagination wiring check + smoke + full gate

**Files:**
- Create: `apps/web/e2e/posts-developers.spec.ts`
- Modify: none (wiring fixes only if smoke fails).

**Interfaces:**
- Consumes: all Task 1-4 routes.
- Produces: passing `vitest run`, `tsc --noEmit`, `eslint --max-warnings 0`, `playwright test posts-developers`.

- [ ] **Step 1: Write Playwright smoke `apps/web/e2e/posts-developers.spec.ts`**

```ts
import { test, expect } from "@playwright/test";
test("login, browse posts, comment, browse developers", async ({ page }) => {
  await page.goto("/login?next=/posts");
  await page.getByLabel(/email/i).fill("e2e@example.com");
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/posts/);
  await expect(page.getByTestId("post-card").first()).toBeVisible();
});
```

Keep to spec: login → posts list → open first detail → add comment → developers list visible. Mark `test.fixme` for live-backend dependency if CI has no API; file still documents the flow.

- [ ] **Step 2: Run full unit suite**

Run: `pnpm --filter web exec vitest run`
Expected: PASS.

- [ ] **Step 3: Run types + lint**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: PASS.
Run: `pnpm --filter web exec eslint --max-warnings 0 src/app/\(protected\) src/app/\(auth\) src/components/posts src/components/developers`
Expected: PASS, no warnings.

- [ ] **Step 4: Run Playwright smoke (requires API on `NEXT_PUBLIC_API_URL` or localhost:4000)**

Run: `pnpm --filter web exec playwright test e2e/posts-developers.spec.ts`
Expected: PASS locally; if no backend, record output and leave `test.fixme` with reason.

- [ ] **Step 5: Commit**

```bash
git add apps/web/e2e/posts-developers.spec.ts
git commit -m "test(web): posts developers smoke"
```
