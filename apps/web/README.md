# DevConnector frontend guide

Current state of the `web` app and the conventions to preserve.

## Current state

- Next.js 16.3.6 App Router with React 19.3 and strict TypeScript.
- The home page is a minimal placeholder; the public profile directory and detail pages are built on it.
- Chakra UI, TanStack React Query, `next-themes`, and the Nuqs Next.js adapter are mounted in the root provider.
- Storybook 9 is configured with stories in `src/stories/` covering every UI component plus a rich ExampleForm.
- Vitest is set up for unit tests; Playwright is available for e2e.
- Typed API clients, shared contracts, and React Query hooks exist but are not yet consumed by application components.
- There is no shared `@dev-conn/ui` package.

## Layout

```text
apps/web/src/
├── app/                    App Router pages, layout, and global styles
├── components/
│   ├── forms/              ExampleForm (rich validated form)
│   └── ui/                 Chakra UI wrappers (43 components)
├── lib/
│   ├── api/                HTTP base client and resource clients
│   └── queries/            React Query hooks
└── stories/                Storybook stories for all UI components

packages/contracts/src/     TypeBox request, response, and parameter schemas
```

`@/` maps to `apps/web/src/`.

```tsx
import { useMyProfile } from "@/lib/queries";
```

## Existing choices

| Need | Use | Current state |
| --- | --- | --- |
| Shared request and response types | `@dev-conn/contracts` | Exported and used by the API and query layers |
| API requests | `@/lib/api` | Implemented; consumed by the public profile pages |
| Cached component data | `@/lib/queries` | Implemented; consumed by the public profile pages |
| UI primitives | Chakra UI | Provider mounted; used by the public profile pages |
| Page and component styles | CSS Modules | `src/components/profiles/profiles.module.css` |
| Global styles | `src/app/globals.css` | Empty placeholder |
| URL state | `nuqs` | Adapter mounted; directory page state comes from `searchParams` |
| Forms | React Hook Form and TypeBox resolvers | ExampleForm implemented |
| Visual testing | Storybook 9 | Stories for all UI components + ExampleForm |
| Unit tests | Vitest | API clients and query hooks tested |
| E2E tests | Playwright | Configured; no specs yet |
| Icons | `react-icons` | Installed; use this instead of adding another icon package |

Do not add a second library for an existing capability. Keep the current starter page separate from DevConnector product UI until product components replace it.

## Server and client components

Components are server components by default. Add `"use client"` only for browser state, event handlers, React Query, React Hook Form, or other client-only APIs. Keep the interactive boundary as small as practical.

```tsx
"use client";

import { useState } from "react";

export function LikeButton() {
  const [liked, setLiked] = useState(false);
  return <button onClick={() => setLiked(!liked)}>{liked ? "Liked" : "Like"}</button>;
}
```

## Styling

Use a CSS Module for component- or page-specific styles:

```tsx
import styles from "./profile.module.css";

export function ProfileCard() {
  return <section className={styles.card}>Profile</section>;
}
```

Use `src/app/globals.css` only for genuinely global resets, body styles, and shared variables. It currently contains only a placeholder comment. Chakra is available through the root `ChakraProvider`; do not add another provider or import Emotion directly. Avoid assigning the same visual property to both Chakra props and a CSS Module without a clear reason.

There is no shared UI package. Keep app-specific components under `src/components` until a second app needs the same stable API.

## API and React Query

Resource clients live in `src/lib/api`. Inside React components, prefer the hooks in `src/lib/queries`; they wrap those clients with query keys, cache state, and mutation invalidation.

```tsx
"use client";

import { useMyProfile } from "@/lib/queries";

export function ProfileSummary() {
  const { data, isLoading, error } = useMyProfile();
  if (isLoading) return <p>Loading profile…</p>;
  if (error) return <p>Could not load your profile.</p>;
  return <h1>{data.profile._id}</h1>;
}
```

The query layer currently contains:

- Auth: register, login, and logout mutations
- Profiles: list, current profile, profile by ID, and profile/experience/education mutations
- Posts: list, detail, comments, post mutations, and comment/like mutations

Disable submit actions while mutations are pending and expose failures near the affected action or field. Do not update query cache manually unless the existing hook does not already perform the required invalidation.

The client sends cookies automatically, serializes JSON, returns `undefined` for `204`, and throws `ApiError` for non-2xx responses. `NEXT_PUBLIC_API_URL` selects the base URL and defaults to `http://localhost:4000`.

```ts
import { authApi } from "@/lib/api/auth";

const user = await authApi.login({ email, password });
```

Handle expected errors where users need a specific response:

```ts
import { ApiError } from "@/lib/api/client";
import { profileApi } from "@/lib/api/profile";

try {
  await profileApi.getMyProfile();
} catch (error) {
  if (error instanceof ApiError && error.status === 401) {
    return { redirectToLogin: true };
  }
}
```

Do not expose raw backend messages unless they are known to be safe. Prefer a stable `ApiError.code` for branching.

## Forms and contracts

Use TypeBox schemas from `@dev-conn/contracts` as the source of truth for API input and field validation. Client validation improves feedback, but the server remains authoritative. Do not duplicate contract rules unless a form has a genuinely different requirement.

React Hook Form and the TypeBox resolver are used by `src/components/forms/ExampleForm.tsx`:

```tsx
"use client";

import { LoginUserSchema, type LoginUserInput } from "@dev-conn/contracts";
import { typeboxResolver } from "@hookform/resolvers/typebox";
import { useForm } from "react-hook-form";
import { useLoginMutation } from "@/lib/queries";

export function LoginForm() {
  const login = useLoginMutation();
  const { register, handleSubmit, formState } = useForm<LoginUserInput>({
    resolver: typeboxResolver(LoginUserSchema),
  });

  return (
    <form onSubmit={handleSubmit((values) => login.mutate(values))}>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" {...register("email")} />
      <label htmlFor="password">Password</label>
      <input id="password" type="password" {...register("password")} />
      {formState.errors.email && <p>{formState.errors.email.message}</p>}
      <button type="submit" disabled={login.isPending}>
        {login.isPending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
```

## URL state, notifications, and accessibility

Use `nuqs` for shareable filters and sorting. Pagination that only needs the current value is read from `searchParams` in the page and passed down. Keep temporary UI state such as open menus and drafts in React state. A Chakra-based toaster exists locally; use it for transient feedback rather than as the only place to report an error.

- Use `next/image` for images and meaningful `alt` text.
- Use `next/link` for internal navigation and buttons for actions.
- Associate every form label with its input.
- Mark decorative icons `aria-hidden`; label icon-only buttons.
- Never use color alone to communicate state or errors.
- Keep keyboard focus and reduced-motion behavior intact.

## Before you finish

Run from `apps/web`:

```bash
pnpm lint
pnpm check-types
pnpm build
```

Manually verify loading, empty, success, and error states; pending actions; keyboard focus; form labels; and light/dark behavior where relevant.
