# Storybook for apps/web — Design Spec

Date: 2026-09-25. Status: approved for planning.

## 1. Outcome & intent

User (Alex) wants a runnable Storybook server showcasing the shared UI kit,
plus the missing common pieces (Button, rich Form), so any dev can spin it up
and browse all inputs in one place.

Success = `pnpm --filter web storybook` opens a working Storybook with stories
for Button, every common input, and one rich validated example form.
What the user said: Storybook + stories for common components, add Button and
Form (rich, many input types). Agreed scope: BOTH reusable per-input stories
AND one full example form. Button via Chakra CLI snippets.

Assumption to confirm in plan: no visual-regression testing in v1 (stories only).

## 2. Key findings (project context)

- `apps/web/src/components/ui/` has 42 Chakra-based wrappers, no `button.tsx`,
  no `input.tsx`/`textarea.tsx` (those come straight from `@chakra-ui/react`).
- `npx @chakra-ui/cli snippet list` (60 snippets) has NO `button` snippet —
  plain Chakra `Button` needs no snippet. So: no new `button.tsx` wrapper,
  stories use Chakra `Button` directly (YAGNI; add a wrapper only if variants
  diverge later).
- Stack: Next 16.3.5, React 19.3, Chakra 3.37, `react-hook-form` + resolvers
  already installed, pnpm workspaces + turbo, `lint` runs with
  `--max-warnings 0`, `check-types` runs `next typegen && tsc --noEmit`.
- App `Provider` wraps `NuqsAdapter` (needs Next app-router context) — stories
  must NOT reuse it directly; decorator uses `ChakraProvider` + `ColorModeProvider`
  only.

## 3. Architecture

- Storybook 9 + `@storybook/nextjs` framework (webpack5 default, keeps one
  Next-native toolchain; no separate Vite setup) installed in `apps/web` only.
- Config: `apps/web/.storybook/main.ts` (stories glob
  `../src/**/*.stories.@(ts|tsx)`, addons: essentials + a11y minimal),
  `apps/web/.storybook/preview.tsx` (Chakra decorator, light/dark via
  `ColorModeProvider`, `@/*` alias reused from tsconfig).
- New runtime code (kept minimal): `src/components/forms/ExampleForm.tsx` —
  the single rich demo form (react-hook-form + zod via existing
  `@hookform/resolvers`). All other stories render existing `ui/*` wrappers
  or Chakra primitives directly; no other new components.
- Scripts in `apps/web/package.json`: `storybook` (port 6006),
  `build-storybook`. No root/turbo changes in v1 (run with
  `pnpm --filter web …`).

## 4. Stories (files touched/added)

Per-input stories (each `*.stories.tsx` next to source, CSF3, autodocs):
`Button` (Chakra Button: variants/sizes/loading/disabled),
`Field` + `Input`/`Textarea`, `PasswordInput`, `NumberInput` + `StepperInput`,
`NativeSelect` + `Select`, `Checkbox`, `Radio` (+ RadioCard if cheap),
`Switch`, `PinInput`, `TagsInput`, `Rating`, `SegmentedControl`.
Stretch (only if zero-cost, drop otherwise): `Slider`, `Alert`, `Dialog`,
`Menu`, `Tooltip`, `Toaster`.
Rich form: `ExampleForm.stories.tsx` covering text, password, number,
textarea, native date input (`type="date"`, no date-picker dep), select,
checkbox group, radio group, switch, tags, submit + zod error messages.

## 5. Data flow / error handling

Stories are static/mocked — no API calls, no QueryClient. ExampleForm keeps
state in react-hook-form, validates with zod on submit/blur, shows errors via
existing `Field` `errorText`; submit action logs values (Storybook actions).
No new error boundaries in v1.

## 6. Testing & verification

- `pnpm --filter web storybook` boots with zero errors.
- `pnpm --filter web build-storybook` succeeds (storybook-static output).
- Existing gates still green: `check-types`, `lint` (stories must pass
  `--max-warnings 0`; use `type` aliases, not empty interfaces).
- Manual: open each story, toggle controls, submit ExampleForm valid/invalid.
