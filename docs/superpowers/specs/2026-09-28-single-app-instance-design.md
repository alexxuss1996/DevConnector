# Single app instance for tests and production

Date: 2026-09-28
Status: approved in conversation, pending spec review

## Problem

`src/app.ts` builds the real application with two `@fastify/autoload` calls: one
over `src/plugins/`, one over `src/routes/`. The test harness
(`test/helpers/app.ts` → `buildApp`, `test/helpers/integration.ts` →
`buildIntegrationApp`) never calls it. It reconstructs a Fastify instance by
hand-registering a hand-picked subset:

- cookie, jwt, auth, csrf, mongoose — the ones the tests need
- **not** cors, helmet, rate-limit, swagger, oauth
- 24 route imports, listed by hand, with prefixes written out

Two consequences:

1. **Wiring drift is invisible.** Delete or rename a plugin file and every test
   still passes; production breaks. The test suite is large (412 unit + 20
   integration) and green, so it reads as coverage of the app. It is coverage
   of a reconstruction.
2. **The two route lists are kept in sync by hand.** `buildIntegrationApp`
   registered `logoutAllRoute` while `buildApp` did not. That is the class of
   bug the harness exists to prevent.

A related symptom: `auth.service.ts:459` branches on `(session as any).__v`
with the comment "Stubbed/plain session objects in tests carry no `__v` —
fall back to save." Production code has a branch that exists because a test
double is shaped differently from a real Mongoose document.

## Goal

Every test boots the real application wiring, through `src/app.ts`, with
explicit substitutions for the three plugins that reach outside the process.

The load-bearing property: **plugin registration becomes explicit imports, so
the compiler enforces it.** Deleting `src/plugins/helmet.ts` becomes a build
failure instead of a silent production regression. That is the guarantee
autoload never provided and the reason the harness exists at all.

## Non-goals

- Not rewriting the 9,500 lines of tests. They keep stubbing Mongoose models
  via `stubMethod`; only the server becomes real.
- Not fixing the `__v` branch. Real server, still fake documents.
- Not changing any route's behaviour, request/response shape, or validation.
- Not adding test-only branches to `src/`. Substitutions arrive as parameters.

## Design

### The seam

`src/app.ts` keeps the two exports `fastify-cli` depends on — `options` and the
default plugin — and gains a third:

```ts
export interface PluginOverrides {
  oauth?: FastifyPluginAsync;
  db?: FastifyPluginAsync;
  rateLimitKey?: (request: FastifyRequest) => string;
}

export interface AppOptions extends FastifyServerOptions {
  overrides?: PluginOverrides;
}

export async function createApp(
  opts: Partial<FastifyServerOptions> & { overrides?: PluginOverrides } = {},
): Promise<FastifyInstance> {
  const { overrides, ...serverOpts } = opts;
  const server = Fastify({ ...options, ...serverOpts });
  await server.register(app, { overrides });
  await server.ready();
  return server;
}
```

`overrides` is destructured out rather than spread into `Fastify()`, which does
not know that option.

Production keeps running through `fastify start dist/app.js --options`, which
instantiates the plugin itself. Tests call `createApp()`. One wiring function,
two callers.

`AppOptions` drops `Partial<AutoloadPluginOptions>` — that type existed only to
describe the plugins autoload, and the plugins are no longer autoloaded.

`options` also stops being `FastifyServerOptions`-only in practice: tests pass
`logger: false` so 83 suite boots stay quiet. `createApp` spreads caller
options over the defaults, so that is already covered.

### Plugin registration and order

The autoload over `src/plugins/` is replaced with explicit registration, in the
order autoload's alphabetical sort produced:

```
auth → cookie → cors → csrf → helmet → jwt → db → oauth → rate-limit → swagger
```

Order is load-bearing in three places:

- `auth` decorates `authenticate`, which every route handler references
- `csrf` adds an `onRequest` hook, which only applies to routes registered after
  it
- `db` and `oauth` are fp-wrapped plugins whose decorations must exist before
  the routes that use them

All ten plugins are wrapped in `fastify-plugin`, which lifts their decorations
out of encapsulation. The two substituted plugins must be wrapped the same way
or their decorations stay scoped to their own registration.

### Route loading

Autoload over `src/routes/` is **kept**, with `dirNameRoutePrefix: true`.

It is not the source of the problem: production and tests call the same
`autoload(routes)` inside `app.ts`, so a route file dropped into `src/routes/`
is live in both with no edit to either. Keeping it deletes the 24-entry route
table and removes the sync hazard outright — there is only ever one list,
because there is no list.

### The three substitutions

Each arrives as a destructured default, so production code has no notion of
"test":

```ts
const { oauth = oauthPlugin, db = mongoosePlugin, rateLimitKey } =
  overrides ?? {};
```

| Override | Production | Tests |
| --- | --- | --- |
| `oauth` | `plugins/oauth.ts` | fp-wrapped plugin decorating `googleOAuth2` with `getAccessTokenFromAuthorizationCodeFlow` returning a fixed token |
| `db` | `plugins/mongoose.ts` | no-op plugin; models are already stubbed per-test by `stubMethod` |
| `rateLimitKey` | plugin default | `() => randomUUID()` |

The oauth substitution is required: `plugins/oauth.ts` uses
`discovery: { issuer: "https://accounts.google.com" }`, so `@fastify/oauth2`
fetches the OIDC discovery document over the network at registration time. The
db substitution is required: `plugins/mongoose.ts` calls `mongoose.connect`
with a 30-second server-selection timeout. Both stubs move out of
`test/helpers/app.ts` into a new `test/helpers/plugin-overrides.ts` — they are
test doubles, not harness.

### Rate limiter

`src/plugins/rate-limit.ts` currently hardcodes `max: 100` and is not loaded by
the harness at all. Loading the real plugin activates the per-route budgets,
and the suite exceeds three of them:

| Route | Budget | Hits in the suite |
| --- | --- | --- |
| `POST /auth/login` | 5 / min | 14 |
| `POST /auth/register` | 5 / min | 15 |
| `POST /auth/refresh` | 20 / min | 23 |

A global `max` override does not help: Fastify's route-level
`config.rateLimit` takes precedence, and the plugin exposes no way to disable
route overrides. The suite would 429 on three routes — not from bugs, but
because the budget is per-minute-per-IP and `inject()` reuses the IP.

So `plugins/rate-limit.ts` gains one optional parameter:

```ts
export default fp<FastifyPluginAsync<{ keyGenerator?: (r: FastifyRequest) => string }>>(
  async (fastify, opts) => {
    await fastify.register(rateLimit, {
      global: true,
      max: 100,
      timeWindow: "1 minute",
      // ...unchanged
      ...(opts.keyGenerator ? { keyGenerator: opts.keyGenerator } : {}),
    });
  },
);
```

Tests pass `() => randomUUID()`, so every request gets its own bucket and no
budget trips. Production passes nothing and keeps the plugin's own keying. The
real plugin, the real route configs, and the real 429 response all run in every
suite; the existing `test/plugins/rate-limit.test.ts` continues to cover the
limit-exceeded path, since it builds its own Fastify instance and never
consults the harness.

The stale comment on lines 5-6 of that file ("tests use buildApp helper without
this plugin") goes away with the change.

## Changes

**Modified**

- `src/app.ts` — explicit plugin registration, `createApp`, `PluginOverrides`,
  `AppOptions.overrides`; drop `Partial<AutoloadPluginOptions>`
- `src/plugins/rate-limit.ts` — accept `keyGenerator`
- `test/tsconfig.json` — add `#app` path; remove the dead `#hooks/*` mapping
  (points at `src/hooks/`, which does not exist)
- `package.json` — add `"#app": "./dist/app.js"` to `imports`
- `test/helpers/app.ts` — delete `buildApp`; keep `signAccessToken`,
  `signRefreshToken`, `ensureSessionStub`
- `test/helpers/integration.ts` — delete `buildIntegrationApp`; keep
  `toLocalMongoUri`, `appendDbSuffix`, `cleanDb`, `testEmail`, `testName`

**Added**

- `test/helpers/plugin-overrides.ts` — the oauth stub and the no-op db plugin

**Call-site updates** — 15 test files switch `buildApp({ withRoutes: true })`
to `createApp({ logger: false, overrides: { oauth, db } })` and
`buildIntegrationApp({...})` to
`createApp({ logger: false, overrides: { oauth: oauthStub, db: mongoosePlugin, rateLimitKey: () => randomUUID() } })`:

`test/auth/routes.test.ts`, `test/auth/service.test.ts`,
`test/integration/{auth,posts,profile}.integration.test.ts`,
`test/posts/{get-post,new-routes,routes,update-comment}.test.ts`,
`test/profiles/{coverage,delete,get-by-id,github,response-contract,routes}.test.ts`

`response-contract.test.ts` builds five instances and is the only file needing
repeated updates.

Untouched: `test/plugins/csrf.test.ts` and `test/plugins/rate-limit.test.ts`
construct their own Fastify instances directly and never consult the harness.

## Verification

- `pnpm run build` — 3/3 packages
- `pnpm run check-types` — 3/3 packages
- `pnpm run lint` — clean at `--max-warnings 0`
- `apps/api` unit: 412 tests, 0 failures (count must not drop; no test may be
  deleted or skipped to make this pass)
- `apps/api` integration: 20 tests, 0 failures, against the Docker Mongo
- `apps/web` vitest: 21 tests

The unit count is a hard gate. If a suite cannot run against the real wiring,
that is a finding about the design, not a test to remove.

## Risks and accepted consequences

- **Boot cost.** 83 suites × full plugin registration. No network once oauth is
  substituted, and every plugin is in-process, so this should be small — but it
  is not free and should be measured before and after. If it is material, the
  fix is fewer boots, not a faster harness.
- **Latent failures surface.** Tests that were silently passing against the
  reconstruction may now fail against real `cors`, `helmet`, `csrf`, or
  `swagger` behaviour. Each failure is a genuine gap between the two, and is the
  point of the exercise. No test asserts on helmet-added headers today, so the
  expected count of new failures is low.
- **`response-contract.test.ts`** pins the wire format through the real response
  serializer. Loading the real `swagger` makes those schemas live, so this file
  is the most likely to need adjustment.
- **The `__v` branch in `auth.service.ts:459` remains.** A real server does not
  make test fakes into real Mongoose documents. Only giving the fakes a `__v`
  would remove it. Separate work.
- **Explicit plugin imports are compile-time enforced; route files are not.**
  Deleting a plugin fails the build. Deleting a route file does not — autoload
  simply loads one fewer. That asymmetry is accepted: routes have no
  substitution seam, and a missing route fails its own tests when they hit it.

## Out of scope

Replacing `fastify-cli` with a plain `node dist/server.js` entry point;
removing `@fastify/autoload` entirely; giving the test doubles a real `__v`; any
change to the frontend.
