# Single App Instance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every test boot the real application wiring from `src/app.ts`, so deleting or renaming a plugin file is a build failure rather than a silent production regression.

**Architecture:** Replace the `@fastify/autoload` call over `src/plugins/` with explicit `fastify.register` calls, which makes the compiler enforce the plugin list. Keep the autoload call over `src/routes/` unchanged, since production and tests invoke the same call inside `app.ts`. The three plugins that reach outside the process (oauth, db, rate-limit keying) are passed in as parameterised `overrides` on a new `createApp()` factory; no `NODE_ENV` branching is added to `src/`.

**Tech Stack:** Fastify 5, `@fastify/autoload` 6, `@fastify/rate-limit` 11, Mongoose 9, `node:test` + `node:assert/strict`, pnpm workspaces, Turbo.

**Spec:** `docs/superpowers/specs/2026-09-28-single-app-instance-design.md`

## Global Constraints

- **The unit test count must never fall below the previous task's, and no test may be deleted, skipped, or commented out to make a run green.** Expected count: **412** at the start, **414** after Task 1, **420** after Task 2, **423** from Task 3 onward. (`test:unit` globs `test/{auth,posts,profiles,plugins,helpers}/*.test.ts`; Task 2 adds `test/*.test.ts` so its new root-level file runs.) If a suite cannot boot against the real wiring, that is a finding about this design — stop and report it rather than deleting the test.
- Integration suite stays at **20** (6 + 7 + 7). Web vitest stays at **21**.
- No `NODE_ENV === "test"` branch, and no other test-detection, anywhere under `src/`. Substitutions arrive only through the `overrides` parameter.
- `apps/api` typecheck is two commands, both must stay clean: `npm run build:ts` (compiles `src/` to `dist/`) and `npx tsc -p test/tsconfig.json` (typechecks tests, `noEmit`).
- Test imports follow the existing dual-resolution pattern already in the repo: `#`-prefixed bare specifiers resolve to **built** `dist/*.js` at runtime and to `src/*.ts` for typechecking, while relative `../helpers/*.ts` specifiers load **source** directly. Do not change this.
- `pnpm run lint` must stay clean. Note it only covers `apps/web`, which is the only package with a `lint` script; `apps/api` is not linted today. Adding one is out of scope, so do not claim api lint coverage as verification.
- `src/plugins/README.md` is a non-plugin file living in the plugins directory. Explicit registration means nothing scans that directory any more, so it needs no exclusion.

## Review Focus

Five failure modes the spec implies that no existing test exercises. Each gets a test in the task named below.

1. **The production boot path is untested and this plan rewrites it.** `npm start` runs `fastify start dist/app.js --options`, which instantiates the *default export* as a plugin. If that export stops being a two-argument `FastifyPluginAsync`, production breaks and all 432 tests still pass because they call `createApp`. → Task 2.
2. **A new plugin file added to `src/plugins/` is silently not wired.** Explicit registration fixes deletion-by-compiler but not addition-by-omission: nothing errors, the plugin just never loads. → Task 2.
3. **A route starts calling a second method on `fastify.googleOAuth2`.** The decoration is typed by the `declare module "fastify"` augmentation in `src/types/fastify.d.ts` as the real `OAuth2Namespace`, so route code typechecks against the real type no matter what the stub declares — **no compile-time guard is available here, and none should be claimed.** The stub lacking a method surfaces as a `TypeError` at request time, which is a red test but an unnamed one. The test below makes the failure name the missing method. → Task 3.
4. **A new test file forgets the `rateLimitKey` override.** It gets the real per-IP bucket and fails with an unexplained 429 partway through the suite. → Task 1.
5. **A test omits `logger: false` and floods the run with pino output from 83 boots**, burying real failures. → Task 4.

---

### Task 1: Let the rate limiter be keyed per request

`src/plugins/rate-limit.ts` currently hardcodes `max: 100` and is loaded by neither the test harness nor anything that varies it. The suite makes 14 hits to `POST /auth/login` (budget 5/min), 15 to `/auth/register` (5/min) and 23 to `/auth/refresh` (20/min), all from `inject()` sharing one `request.ip`. A global `max` override cannot fix this: Fastify's route-level `config.rateLimit` takes precedence and the plugin exposes no way to disable route overrides. Keying each request uniquely gives every request its own bucket, so the real plugin and the real route budgets run in every suite without tripping.

**Files:**
- Modify: `apps/api/src/plugins/rate-limit.ts:1-6`
- Test: `apps/api/test/plugins/rate-limit.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `rateLimitPlugin` accepts `{ keyGenerator?: (request: FastifyRequest) => string }` as its plugin options. Task 2 registers it as `fastify.register(rateLimitPlugin, rateLimitKey ? { keyGenerator: rateLimitKey } : {})`.

- [ ] **Step 1: Write the failing test**

Merge these into the existing header of `apps/api/test/plugins/rate-limit.test.ts`, keeping the imports already there:

```ts
import Fastify, { type FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import rateLimitPlugin from "#plugins/rate-limit";
```

Then append:

```ts
describe("per-request keying", () => {
  const build = async (keyGenerator?: (request: unknown) => string) => {
    const instance = Fastify({ logger: false });
    await instance.register(rateLimitPlugin, { keyGenerator });
    instance.get("/ping", async () => ({ ok: true }));
    await instance.ready();
    return instance;
  };

  const hammer = async (instance: FastifyInstance) => {
    let limited = 0;
    for (let i = 0; i < 150; i++) {
      const res = await instance.inject({ method: "GET", url: "/ping" });
      if (res.statusCode === 429) limited++;
    }
    return limited;
  };

  test("the default keyer shares one bucket, so the limit is reached", async () => {
    const app = await build();
    const limited = await hammer(app);
    await app.close();
    assert.ok(limited > 0, "the plugin should have limited some requests");
  });

  test("a per-request keyer gives every request its own bucket", async () => {
    const app = await build(() => randomUUID());
    const limited = await hammer(app);
    await app.close();
    assert.equal(limited, 0, "no request should be limited");
  });
});
```

The pair matters: the first test proves the plugin really does limit, so the second test's zero is evidence the keyer worked rather than evidence the plugin is inert.

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/api && npm run build:ts && npx tsc -p test/tsconfig.json && node --env-file=.env --test "test/plugins/rate-limit.test.ts"
```

Expected: the first test PASSES, the second FAILS with `limited > 0` where `0` was expected. `fp()` currently discards its options, so `keyGenerator` is ignored and the shared bucket still limits.

- [ ] **Step 3: Write minimal implementation**

Replace lines 1-6 of `apps/api/src/plugins/rate-limit.ts` so the plugin forwards a caller-supplied keyer. Everything from `global: true` down stays byte-identical.

```ts
import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";
import type { FastifyRequest } from "fastify";

/**
 * `keyGenerator` exists so tests can key every request uniquely and never trip
 * a budget; production passes nothing and keeps the plugin's own per-IP
 * keying. The limits below and the per-route `config.rateLimit` overrides in
 * src/routes are the real ones — this seam does not relax them.
 */
export default fp<{ keyGenerator?: (request: FastifyRequest) => string }>(
  async (fastify, opts) => {
    await fastify.register(rateLimit, {
      global: true,
      max: 100,
      timeWindow: "1 minute",
      allowList: ["/", "/docs"],
      enableDraftSpec: true,
      addHeaders: {
        "x-ratelimit-limit": true,
        "x-ratelimit-remaining": true,
        "x-ratelimit-reset": true,
        "retry-after": true,
      },
      addHeadersOnExceeding: {
        "x-ratelimit-limit": true,
        "x-ratelimit-remaining": true,
        "x-ratelimit-reset": true,
      },
      errorResponseBuilder: (_request, context) => {
        return {
          code: "RATE_LIMIT_EXCEEDED",
          message: `Too many requests, please try again after ${context.after}`,
          statusCode: 429,
          retryAfter: context.after,
        };
      },
      ...(opts.keyGenerator ? { keyGenerator: opts.keyGenerator } : {}),
    });
  },
);
```

The old comment on lines 5-6 ("tests use buildApp helper without this plugin") is deleted — it describes the harness this plan removes.

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd apps/api && npm run build:ts && npx tsc -p test/tsconfig.json && node --env-file=.env --test "test/plugins/rate-limit.test.ts"
```

Expected: both tests PASS.

- [ ] **Step 5: Run the full unit suite**

```bash
cd apps/api && npm run test:unit
```

Expected: `tests 414`, `pass 414`, `fail 0` — 412 plus the 2 added to `test/plugins/rate-limit.test.ts`, which the `test:unit` glob already covers. The plugin's behaviour is unchanged when `keyGenerator` is absent, and the suite still runs against the harness, which does not load it.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/plugins/rate-limit.ts apps/api/test/plugins/rate-limit.test.ts
git commit -m "Let the rate limiter be keyed per request

The plugin hardcoded its keyer, so the only way to give the suite its own
buckets would have been to relax max — which cannot work, because the
per-route config.rateLimit overrides in src/routes take precedence over the
global setting.

A caller-supplied keyGenerator gives each request its own bucket. Production
passes nothing and keeps the plugin's own per-IP keying; the real limits and
the real route budgets still apply."
```

---

### Task 2: One wiring, two entry points

Replace the plugin autoload with explicit registration and add `createApp`. This is the task that makes the compiler enforce the plugin list.

**Files:**
- Modify: `apps/api/src/app.ts` (whole file)
- Modify: `apps/api/package.json` — add `"#app": "./dist/app.js"` to `imports`; add `"test/*.test.ts"` to the `test:unit` glob
- Modify: `apps/api/test/tsconfig.json` — add `"#app": ["src/app.ts"]`, remove the dead `"#hooks/*"` entry (it points at `src/hooks/`, which does not exist)
- Test: `apps/api/test/app.test.ts` (new)

**Interfaces:**
- Consumes: `rateLimitPlugin(opts?: { keyGenerator?: (request: FastifyRequest) => string })` from Task 1.
- Produces:
  - `export interface PluginOverrides { oauth?: FastifyPluginAsync; db?: FastifyPluginAsync; rateLimitKey?: (request: FastifyRequest) => string }`
  - `export interface AppOptions extends FastifyServerOptions { overrides?: PluginOverrides }`
  - `export async function createApp(opts?: Partial<FastifyServerOptions> & { overrides?: PluginOverrides }): Promise<FastifyInstance>`
  - default export and named `app`: unchanged `FastifyPluginAsync<AppOptions>`, still what `fastify-cli` loads.
  - Tasks 3-5 import `createApp` from `"#app"`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/test/app.test.ts` in full. This covers Review Focus items 1, 2 and 5.

```ts
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { app, options, createApp } from "#app";

const oauthStub = fp(async (fastify) => {
  fastify.decorate("googleOAuth2", {
    getAccessTokenFromAuthorizationCodeFlow: async () => ({
      token: { access_token: "stub", token_type: "Bearer" },
    }),
  });
});
const noDb = fp(async () => {});

const srcFile = (relative: string) =>
  fileURLToPath(new URL(`../src/${relative}`, import.meta.url));

describe("the real wiring", () => {
  let server: FastifyInstance;

  before(async () => {
    server = await createApp({
      logger: false,
      overrides: { oauth: oauthStub, db: noDb },
    });
  });
  after(async () => {
    await server.close();
  });

  test("mounts every route autoload discovers", () => {
    const routes = server.printRoutes();
    for (const path of [
      "auth/login",
      "auth/logout-all",
      "profiles/me",
      "posts/:id/like",
    ]) {
      assert.ok(routes.includes(path), `expected route ${path} in\n${routes}`);
    }
  });

  test("registers cors, which the old harness never loaded", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/",
      headers: { origin: "http://localhost:3000" },
    });
    assert.equal(
      res.headers["access-control-allow-origin"],
      "http://localhost:3000",
    );
  });

  test("registers helmet, which the old harness never loaded", async () => {
    const res = await server.inject({ method: "GET", url: "/" });
    assert.equal(res.headers["x-content-type-options"], "nosniff");
  });

  test("registers the real swagger plugin's docs route", async () => {
    const res = await server.inject({ method: "GET", url: "/docs" });
    assert.notEqual(res.statusCode, 404);
  });

  test("every plugin file in src/plugins is registered in app.ts", () => {
    const appSource = readFileSync(srcFile("app.ts"), "utf8");
    const files = readdirSync(srcFile("plugins/")).filter((f) =>
      f.endsWith(".ts"),
    );
    assert.ok(files.length > 0, "no plugin files found");
    for (const file of files) {
      assert.ok(
        appSource.includes(`#plugins/${file.replace(/\.ts$/, "")}`),
        `src/plugins/${file} is not imported by src/app.ts — add it to the registration list`,
      );
    }
  });
});

test("the default export is still a plugin the CLI can boot", async () => {
  const server = Fastify(options);
  await server.register(app, { overrides: { oauth: oauthStub, db: noDb } });
  await server.ready();
  assert.ok(server.printRoutes().includes("auth/login"));
  await server.close();
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/api && npx tsc -p test/tsconfig.json
```

Expected: FAIL to resolve `"#app"` — `createApp` does not exist and the import map has no `#app` entry. That is the correct red: the seam is absent.

- [ ] **Step 3: Add the module resolution entries and the test glob**

In `apps/api/package.json`, add `"#app": "./dist/app.js"` as the first entry of `imports`:

```json
  "imports": {
    "#app": "./dist/app.js",
    "#helpers/*": "./dist/helpers/*.js",
    "#modules/*": "./dist/modules/*.js",
    "#routes/*": "./dist/routes/*.js",
    "#test/*": "./dist/test/*.js",
    "#types/*": "./dist/types/*.js",
    "#plugins/*": "./dist/plugins/*.js",
    "#config/*": "./dist/config/*.js"
  }
```

In the same file, add `"test/*.test.ts"` to the `test:unit` script so the new root-level test file is actually run — without this the file would be silently skipped by `npm test`:

```
"test:unit": "npm run build:ts && tsc -p test/tsconfig.json && c8 node --env-file=.env --test \"test/*.test.ts\" \"test/auth/*.test.ts\" \"test/posts/*.test.ts\" \"test/profiles/*.test.ts\" \"test/plugins/*.test.ts\" \"test/helpers/*.test.ts\"",
```

In `apps/api/test/tsconfig.json`, add `"#app": ["src/app.ts"]` and delete the `"#hooks/*": ["src/hooks/*.ts"]` line:

```json
    "paths": {
      "#app": ["src/app.ts"],
      "#helpers/*": ["src/helpers/*.ts"],
      "#modules/*": ["src/modules/*.ts"],
      "#routes/*": ["src/routes/*.ts"],
      "#test/*": ["test/*.ts"],
      "#types/*": ["src/types/*.ts"],
      "#plugins/*": ["src/plugins/*.ts"],
      "#config/*": ["src/config/*.ts"]
    }
```

- [ ] **Step 4: Write the implementation**

Replace `apps/api/src/app.ts` in full:

```ts
import "#config/env";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import AutoLoad from "@fastify/autoload";
import Fastify, {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyServerOptions,
} from "fastify";
import { errorHandler } from "#helpers/error-handler";
import { baseOptions, registerRequestIdHook } from "#helpers/request-id";
import authPlugin from "#plugins/auth";
import cookiePlugin from "#plugins/cookie";
import corsPlugin from "#plugins/cors";
import csrfPlugin from "#plugins/csrf";
import helmetPlugin from "#plugins/helmet";
import jwtPlugin from "#plugins/jwt";
import mongoosePlugin from "#plugins/mongoose";
import oauthPlugin from "#plugins/oauth";
import rateLimitPlugin from "#plugins/rate-limit";
import swaggerPlugin from "#plugins/swagger";
import AjvErrors from "ajv-errors";
import addFormats from "ajv-formats";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * The plugins that reach outside the process, so a test can substitute them.
 *
 * This list used to be discovered by autoloading src/plugins. That made
 * deletion of a plugin file invisible: the compiler had no import to fail and
 * the test harness hand-registered its own subset, so every test passed while
 * production broke. Registering explicitly trades a little convenience for a
 * build failure when the wiring and the filesystem disagree.
 */
export interface PluginOverrides {
  oauth?: FastifyPluginAsync;
  db?: FastifyPluginAsync;
  rateLimitKey?: (request: FastifyRequest) => string;
}

export interface AppOptions extends FastifyServerOptions {
  overrides?: PluginOverrides;
}

// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {
  routerOptions: {
    ignoreTrailingSlash: true,
  },
  ...baseOptions,
  logger: {
    level:
      process.env.LOG_LEVEL ??
      (process.env.NODE_ENV === "production" ? "info" : "debug"),
    redact: ["req.headers.authorization", "req.headers.cookie", "req.cookies"],
  },
  ajv: {
    customOptions: {
      coerceTypes: false,
      allErrors: true,
      strict: false,
    },
    plugins: [AjvErrors as any, addFormats as any],
  },
};

const app: FastifyPluginAsync<AppOptions> = async (
  fastify,
  opts,
): Promise<void> => {
  const { oauth = oauthPlugin, db = mongoosePlugin, rateLimitKey } =
    opts.overrides ?? {};

  // Order is load-bearing and matches what autoload's alphabetical sort
  // produced: `auth` decorates `authenticate`, and `csrf` adds an onRequest
  // hook, both of which must exist before the routes registered below.
  await fastify.register(authPlugin);
  await fastify.register(cookiePlugin);
  await fastify.register(corsPlugin);
  await fastify.register(csrfPlugin);
  await fastify.register(helmetPlugin);
  await fastify.register(jwtPlugin);
  await fastify.register(db);
  await fastify.register(oauth);
  await fastify.register(
    rateLimitPlugin,
    rateLimitKey ? { keyGenerator: rateLimitKey } : {},
  );
  await fastify.register(swaggerPlugin);

  // Routes stay autoloaded: production and tests call this same line, so a
  // route file added to src/routes is live in both with no edit to either.
  await fastify.register(AutoLoad, {
    dir: join(__dirname, "routes"),
    options: opts,
    dirNameRoutePrefix: true,
  });

  fastify.setErrorHandler(errorHandler);
  registerRequestIdHook(fastify);
  fastify.ready(() => {
    if (process.env.NODE_ENV !== "production") {
      fastify.log.info(fastify.printRoutes());
    }
  });
};

/**
 * Boots the same wiring the CLI boots, with substitutions. `overrides` is
 * destructured out rather than spread into Fastify(), which does not know
 * that option.
 */
export async function createApp(
  opts: Partial<FastifyServerOptions> & { overrides?: PluginOverrides } = {},
): Promise<FastifyInstance> {
  const { overrides, ...serverOpts } = opts;
  const server = Fastify({ ...options, ...serverOpts });
  await server.register(app, { overrides });
  await server.ready();
  return server;
}

export default app;
export { app, options };
```

- [ ] **Step 5: Run the new test to verify it passes**

```bash
cd apps/api && npm run build:ts && npx tsc -p test/tsconfig.json && node --env-file=.env --test "test/app.test.ts"
```

Expected: all 6 tests PASS, including the plugin-coverage test and the CLI-path test.

- [ ] **Step 6: Run the full unit suite**

```bash
cd apps/api && npm run test:unit
```

Expected: `tests 420`, `pass 420`, `fail 0` — 414 plus the 6 new ones. The old harness is still what the 12 suites use at this point, so their count is untouched.

- [ ] **Step 7: Verify the CLI contract against the built output**

```bash
cd apps/api && npm run build && node --env-file=.env -e "
import('./dist/app.js').then((m) => {
  const ok = typeof m.default === 'function'
    && m.default.length === 2
    && typeof m.options === 'object'
    && typeof m.createApp === 'function';
  if (!ok) { console.error('CLI contract broken:', Object.keys(m)); process.exit(1); }
  console.log('CLI contract OK: default export is a 2-arg plugin, options and createApp exported');
});
"
```

Expected: `CLI contract OK`. `FastifyPluginAsync` is `(instance, opts) => Promise<void>`, so `length === 2` is the precise check that `fastify start` can still load it. This replaces booting a real server, which would block for 30 seconds on `mongoose.connect` before failing for unrelated reasons.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/app.ts apps/api/package.json apps/api/test/tsconfig.json apps/api/test/app.test.ts
git commit -m "Register plugins explicitly and add createApp

Autoloading src/plugins meant the compiler never saw a plugin import, so
deleting or renaming one broke production while all 432 tests passed
against a harness that registered its own hand-picked subset. Explicit
registration makes the wiring compile-time enforced.

Routes stay autoloaded: production and tests now invoke the same
autoload(routes) call, so the two lists can no longer drift.

createApp boots that same wiring for tests, with the three plugins that
reach outside the process (oauth's network discovery, the mongoose
connection, rate-limit keying) passed in as overrides."
```

---

### Task 3: The override stubs

**Files:**
- Create: `apps/api/test/helpers/plugin-overrides.ts`
- Test: `apps/api/test/helpers/plugin-overrides.test.ts`

**Interfaces:**
- Consumes: `PluginOverrides` from Task 2.
- Produces: `oauthStub: FastifyPluginAsync`, `noDb: FastifyPluginAsync`, `oauthStubNamespace`, imported by Tasks 4 and 5 as `from "../helpers/plugin-overrides.ts"`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/test/helpers/plugin-overrides.test.ts`. The second test is Review Focus item 3.

```ts
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { oauthStub, oauthStubNamespace, noDb } from "./plugin-overrides.ts";

describe("oauthStub", () => {
  test("decorates googleOAuth2 with a working code exchange", async () => {
    const server: FastifyInstance = Fastify({ logger: false });
    await server.register(oauthStub);
    await server.ready();

    const result =
      await server.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow();
    assert.equal(result.token.access_token, "google-access-token");
    await server.close();
  });

  test("exposes every method the routes call on it", () => {
    const routesDir = fileURLToPath(new URL("../../src/routes/", import.meta.url));
    const called = new Set<string>();
    for (const entry of readdirSync(routesDir, { recursive: true })) {
      if (!String(entry).endsWith(".ts")) continue;
      const source = readFileSync(join(routesDir, String(entry)), "utf8");
      for (const match of source.matchAll(/googleOAuth2\.(\w+)/g)) {
        called.add(match[1]);
      }
    }
    assert.ok(called.size > 0, "expected at least one googleOAuth2 call in src/routes");
    for (const name of called) {
      assert.equal(
        typeof (oauthStubNamespace as Record<string, unknown>)[name],
        "function",
        `src/routes calls googleOAuth2.${name} but the stub does not provide it`,
      );
    }
  });
});

describe("noDb", () => {
  test("registers without opening a connection", async () => {
    const server = Fastify({ logger: false });
    await server.register(noDb);
    await server.ready();
    assert.equal(server.printRoutes().length >= 0, true);
    await server.close();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/api && npx tsc -p test/tsconfig.json
```

Expected: FAIL — `./plugin-overrides.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `apps/api/test/helpers/plugin-overrides.ts`:

```ts
import fp from "fastify-plugin";

/**
 * The only method src/routes uses on the namespace today. The route-facing
 * type comes from the `declare module "fastify"` augmentation in
 * src/types/fastify.d.ts, so a route calling a second method would still
 * typecheck against the real OAuth2Namespace while failing here at runtime
 * with an unnamed TypeError. The test that guards this lives next to this
 * file and greps src/routes for the methods it calls.
 */
export const oauthStubNamespace = {
  getAccessTokenFromAuthorizationCodeFlow: async () => ({
    token: { access_token: "google-access-token", token_type: "Bearer" },
  }),
};

/**
 * Stands in for @fastify/oauth2, which fetches Google's OIDC discovery
 * document over the network at registration time. fp() so the decoration
 * escapes encapsulation exactly as the real plugin's does.
 */
export const oauthStub = fp(async (fastify) => {
  fastify.decorate("googleOAuth2", oauthStubNamespace);
});

/**
 * Unit tests stub Mongoose models per test via stubMethod, so the server must
 * not open a connection. Integration tests omit this override and get the
 * real plugins/mongoose.
 */
export const noDb = fp(async () => {});
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd apps/api && npx tsc -p test/tsconfig.json && node --env-file=.env --test "test/helpers/plugin-overrides.test.ts"
```

Expected: 3 tests PASS.

- [ ] **Step 5: Run the full unit suite**

```bash
cd apps/api && npm run test:unit
```

Expected: `tests 423`, `pass 423`, `fail 0` — 420 plus these 3.

- [ ] **Step 6: Confirm the guard actually bites**

Add a second method use to `src/routes/auth/google.ts`, immediately after the existing call:

```ts
fastify.googleOAuth2.generateUri();
```

Run `cd apps/api && npm run test:unit`. Expected: the oauth suites FAIL, and the failure message names the method — `src/routes calls googleOAuth2.generateUri but the stub does not provide it`. That is the whole point of the guard: a red test that says which method is missing, instead of a `TypeError` from deep inside a route.

Then remove the temporary line and confirm the suite is green again:

```bash
cd apps/api && git diff --stat -- src/routes/auth/google.ts && npm run test:unit
```

Expected: `git diff` empty, `tests 423`, `pass 423`, `fail 0`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/test/helpers/plugin-overrides.ts apps/api/test/helpers/plugin-overrides.test.ts
git commit -m "Add the plugin override stubs

oauth's OIDC discovery fetch and the mongoose connection cannot run in a
unit test. Both stubs are fp()-wrapped so their decorations escape
encapsulation the way the real plugins' do.

The oauth stub is guarded by a test that greps src/routes for the
googleOAuth2 methods the routes call: the route-facing type comes from a
module augmentation, so a second method would typecheck and then fail at
runtime with an unnamed TypeError. The guard makes the failure name the
missing method."
```

---

### Task 4: Point the unit tests at the real wiring

Migrate 12 unit test files from `buildApp` to `createApp`, then delete `buildApp`.

**Files:**
- Modify: `apps/api/test/auth/routes.test.ts`, `apps/api/test/auth/service.test.ts`
- Modify: `apps/api/test/posts/get-post.test.ts`, `apps/api/test/posts/new-routes.test.ts`, `apps/api/test/posts/routes.test.ts`, `apps/api/test/posts/update-comment.test.ts`
- Modify: `apps/api/test/profiles/coverage.test.ts`, `apps/api/test/profiles/delete.test.ts`, `apps/api/test/profiles/get-by-id.test.ts`, `apps/api/test/profiles/github.test.ts`, `apps/api/test/profiles/response-contract.test.ts`, `apps/api/test/profiles/routes.test.ts`
- Modify: `apps/api/test/helpers/app.ts` — remove `buildApp`
- Test: the 12 files themselves; `apps/api/test/app.test.ts` stays green.

**Interfaces:**
- Consumes: `createApp` from `"#app"` and `oauthStub`/`noDb` from `"../helpers/plugin-overrides.ts"`, both from Tasks 2 and 3.
- Produces: `test/helpers/app.ts` keeps only `signAccessToken`, `signRefreshToken` and its private `ensureSessionStub`.

- [ ] **Step 1: Migrate `test/auth/service.test.ts` as the representative edit**

It is the smallest — the only file that called `buildApp()` with no routes. Its current lines 16 and 22 are:

```ts
import { buildApp, signRefreshToken } from "../helpers/app.ts";
```
```ts
  app = await buildApp();
```

Replace with:

```ts
import { signRefreshToken } from "../helpers/app.ts";
import { oauthStub, noDb } from "../helpers/plugin-overrides.ts";
import { createApp } from "#app";
```
```ts
  app = await createApp({ logger: false, overrides: { oauth: oauthStub, db: noDb } });
```

- [ ] **Step 2: Migrate the other 11 unit files with the identical two edits**

For each file, apply this pair. Only the surviving `helpers/app.ts` import differs; the call-site replacement is the same everywhere except `response-contract.test.ts`, which has five of them.

| File | Replace the `from "../helpers/app.ts"` import with | Replace `buildApp({ withRoutes: true })` with |
| --- | --- | --- |
| `test/auth/routes.test.ts` | `import { signAccessToken, signRefreshToken } from "../helpers/app.ts";` | `createApp({ logger: false, overrides: { oauth: oauthStub, db: noDb } })` |
| `test/posts/get-post.test.ts` | `import { signAccessToken } from "../helpers/app.ts";` | same |
| `test/posts/new-routes.test.ts` | `import { signAccessToken, signRefreshToken } from "../helpers/app.ts";` | same |
| `test/posts/routes.test.ts` | `import { signAccessToken, signRefreshToken } from "../helpers/app.ts";` | same |
| `test/posts/update-comment.test.ts` | `import { signAccessToken, signRefreshToken } from "../helpers/app.ts";` | same |
| `test/profiles/coverage.test.ts` | `import { signAccessToken, signRefreshToken } from "../helpers/app.ts";` | same |
| `test/profiles/delete.test.ts` | `import { signAccessToken, signRefreshToken } from "../helpers/app.ts";` | same |
| `test/profiles/get-by-id.test.ts` | *(delete the whole import line — `buildApp` was its only import)* | same |
| `test/profiles/github.test.ts` | `import { signAccessToken, signRefreshToken } from "../helpers/app.ts";` | same |
| `test/profiles/response-contract.test.ts` | `import { signAccessToken } from "../helpers/app.ts";` | same, at all five sites (lines 83, 145, 159, 175, 185) |
| `test/profiles/routes.test.ts` | `import { signAccessToken, signRefreshToken } from "../helpers/app.ts";` | same |

Every one of those 11 files also needs these two lines added directly after the `helpers/app.ts` import — or, in `get-by-id.test.ts`, taking its place:

```ts
import { oauthStub, noDb } from "../helpers/plugin-overrides.ts";
import { createApp } from "#app";
```

- [ ] **Step 3: Verify the migration compiles and nothing references `buildApp`**

```bash
cd apps/api && npm run build:ts && npx tsc -p test/tsconfig.json
```

Expected: PASS. Then:

```bash
cd apps/api && grep -rn "buildApp" test/ | grep -v "helpers/app.ts"
```

Expected: no output.

- [ ] **Step 4: Run the full unit suite**

```bash
cd apps/api && npm run test:unit
```

Expected: `tests 423`, `pass 423`, `fail 0`.

If any suite fails, it is a genuine gap between the reconstruction and the real wiring — the real `cors`, `helmet`, `csrf` or `swagger` is now active. Fix the test's assumption to match real behaviour. **Do not** delete or skip the test, and do not weaken a plugin to make it pass. If the fix is not obvious, stop and report it rather than guessing.

- [ ] **Step 5: Delete `buildApp` from `test/helpers/app.ts`**

Remove `buildApp`, its `BuildAppOptions` interface, the `ROUTES` table, the `GOOGLE_STUB` constant, and every import that existed only to serve them: `Fastify`, `authPlugin`, `csrfPlugin`, `mongoose`, `AjvErrors`, `addFormats`, and all 24 `#routes/...` imports. Keep `signAccessToken`, `signRefreshToken`, `ensureSessionStub`, `AuthPayload`, and what they need. The resulting file:

```ts
import type { FastifyInstance } from "fastify";
import Session from "#modules/auth/session.model";
import { Types } from "mongoose";
import {
  lookupSessionUser,
  mkQuery,
  newId,
  recordSessionToken,
  stubMethod,
} from "./stubs.ts";

interface AuthPayload {
  sub: string;
  type: "access" | "refresh";
  sessionId?: string;
}

/**
 * Signs an access token that always carries a sessionId (production auth
 * requires one) and auto-stubs `Session.findById` so the token passes the
 * revocation check without a real database.
 *
 * Tests that need custom session states (revoked, expired, missing) stub
 * `Session.findById` explicitly — the explicit stub replaces this default.
 */
export function signAccessToken(
  app: FastifyInstance,
  payload: Partial<AuthPayload> & Record<string, unknown> = {},
): string {
  const sub = (payload.sub ?? newId().toString()).toString();
  const sessionId = (payload.sessionId ?? newId().toString()).toString();
  recordSessionToken(sessionId, sub);
  ensureSessionStub();
  const { sub: _s, sessionId: _sid, ...rest } = payload;
  return app.jwt.sign(
    { type: "access", ...rest, sub, sessionId } as AuthPayload,
    { expiresIn: "15m" },
  );
}

function ensureSessionStub(): void {
  if ((Session.findById as any).mock) return;
  stubMethod(Session, "findById", ((id: unknown) => {
    const sid = (id as any)?.toString?.() ?? String(id);
    const sub = lookupSessionUser(sid);
    if (!sub) return mkQuery(null);
    return mkQuery({
      _id: new Types.ObjectId(sid),
      userId: new Types.ObjectId(sub),
      refreshTokenHash: "stub-hash",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      revokedAt: undefined,
    } as any);
  }) as any);
}

export function signRefreshToken(
  app: FastifyInstance,
  payload: Partial<AuthPayload> & Record<string, unknown>,
): string {
  return app.jwt.sign({ type: "refresh", ...payload } as AuthPayload, {
    expiresIn: "30d",
  });
}
```

- [ ] **Step 6: Re-run the unit suite after the deletion**

```bash
cd apps/api && npm run build:ts && npx tsc -p test/tsconfig.json && npm run test:unit
```

Expected: `tests 423`, `pass 423`, `fail 0`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/test
git commit -m "Run the unit tests against the real wiring

Twelve suites were booting a hand-registered subset that never loaded cors,
helmet, rate-limit or swagger. They now call createApp, so the real plugins
are active. The test count is unchanged: nothing was removed, skipped or
weakened, and anything that failed did so because it was asserting on the
reconstruction rather than on the app.

buildApp and its 24-entry route table are gone."
```

---

### Task 5: Point the integration tests at the real wiring

Same migration for the three integration suites, which keep the real database.

**Files:**
- Modify: `apps/api/test/integration/auth.integration.test.ts`
- Modify: `apps/api/test/integration/posts.integration.test.ts`
- Modify: `apps/api/test/integration/profile.integration.test.ts`
- Modify: `apps/api/test/helpers/integration.ts` — remove `buildIntegrationApp`, keep the URI helpers and `cleanDb`/`testEmail`/`testName`

**Interfaces:**
- Consumes: `createApp` and `oauthStub` from Tasks 2 and 3, plus `toLocalMongoUri` and `appendDbSuffix`, which stay exported from `test/helpers/integration.ts`.
- Produces: `test/helpers/integration.ts` exports `toLocalMongoUri`, `appendDbSuffix`, `cleanDb`, `testEmail`, `testName`, and nothing else.

- [ ] **Step 1: Migrate the `before` hook in all three files**

Each of the three opens with:

```ts
import { buildIntegrationApp, cleanDb, testEmail, testName } from "../helpers/integration.ts";
```

Replace with:

```ts
import { appendDbSuffix, cleanDb, testEmail, testName, toLocalMongoUri } from "../helpers/integration.ts";
import { oauthStub } from "../helpers/plugin-overrides.ts";
import { createApp } from "#app";
```

Then replace the `before` hook. In all three files `mongoUri` and `jwtSecret` are used only inside the hook, so their `let` declarations (lines 8-9) go. **`frontendUrl` must be kept in `test/integration/auth.integration.test.ts`** — it is read at line 169 (a redirect assertion) and line 283 (a CSRF origin header), so it becomes a module-level `const`.

`test/integration/auth.integration.test.ts` becomes:

```ts
const frontendUrl = "http://localhost:3000";

before(async () => {
  const runId = randomUUID().slice(0, 8);
  const baseUri = process.env.MONGODB_URI ?? "mongodb://localhost:27018/devconnector_test";
  // Per-run database and secret, so parallel runs do not collide. Both are
  // read by src/config/env and src/plugins/mongoose at registration time,
  // which happens inside createApp below — after these assignments.
  process.env.MONGODB_URI = appendDbSuffix(toLocalMongoUri(baseUri), runId);
  process.env.JWT_SECRET = `test-jwt-secret-${randomUUID().slice(0, 16)}`;
  process.env.FRONTEND_URL = frontendUrl;

  app = await createApp({
    logger: false,
    overrides: {
      oauth: oauthStub,
      // `db` is deliberately absent: integration tests want the real mongoose
      // plugin and a real connection.
      rateLimitKey: () => randomUUID(),
    },
  });
});
```

In `test/integration/posts.integration.test.ts` and `test/integration/profile.integration.test.ts`, the same hook applies, except neither file reads `frontendUrl` afterwards, so all three `let` declarations (lines 8-10) are removed and `process.env.FRONTEND_URL` is set from a literal.

The absence of `db` is the test: if an integration suite were accidentally given `noDb`, every assertion would fail against an empty collection.

- [ ] **Step 2: Verify it compiles and nothing references `buildIntegrationApp`**

```bash
cd apps/api && npm run build:ts && npx tsc -p test/tsconfig.json
```

Expected: PASS. Then:

```bash
cd apps/api && grep -rn "buildIntegrationApp" test/ | grep -v "helpers/integration.ts"
```

Expected: no output.

- [ ] **Step 3: Delete `buildIntegrationApp` from `test/helpers/integration.ts``

The file keeps `toLocalMongoUri`, `appendDbSuffix`, `cleanDb`, `testEmail` and `testName`, and loses `buildIntegrationApp`, the re-export of `buildApp`/`BuildAppOptions`, and the now-unused `buildApp` import. The resulting file:

```ts
import type { FastifyInstance } from "fastify";
import mongoose from "mongoose";

/**
 * Integration tests always run against the local MongoDB, even if MONGODB_URI
 * points at Atlas in .env. Keeps only the host and the database name — Atlas
 * query params (ssl, replicaSet, authSource) are cluster-specific and break
 * local, and local mongo has no credentials to authenticate with.
 */
export function toLocalMongoUri(uri: string): string {
  const url = new URL(uri);
  const db = url.pathname.replace(/^\//, "");
  return `mongodb://${url.host}/${db || "devconnector_test"}`;
}

/** Appends a suffix to the database name, for per-run test isolation. */
export function appendDbSuffix(uri: string, suffix: string): string {
  const url = new URL(uri);
  const db = url.pathname.replace(/^\//, "");
  url.pathname = `/${db ? `${db}_${suffix}` : `_${suffix}`}`;
  return url.toString();
}

export async function cleanDb(_app: FastifyInstance): Promise<void> {
  for (const coll of Object.values(mongoose.connection.collections)) {
    await coll.deleteMany({});
  }
}

/** Generates a random email suitable for integration tests. */
export function testEmail(seed: string): string {
  return `integration-${seed}@test.dev`;
}

/** Generates a random username suitable for integration tests. */
export function testName(seed: string): string {
  return `Integration ${seed}`;
}
```

`cleanDb` already reads `mongoose.connection.collections` directly and never used the `db` decorator, so its behaviour is unchanged; the parameter is renamed `_app` because nothing reads it now that the decorator is gone from `src/`.

- [ ] **Step 4: Start the test database and run the integration suite**

```bash
cd apps/api && MONGODB_PORT=27018 bash test/bin/mongo-docker.sh start
```

Expected: prints the connection string. Then:

```bash
cd apps/api && npm run test:integration
```

Expected: three consecutive blocks of `tests 6/7/7`, `pass 6/7/7`, `fail 0` — 20 total, matching the baseline.

Stop the container afterwards:

```bash
cd apps/api && MONGODB_PORT=27018 bash test/bin/mongo-docker.sh stop
```

- [ ] **Step 5: Re-run the unit suite, which now shares the real wiring**

```bash
cd apps/api && npm run test:unit
```

Expected: `tests 423`, `pass 423`, `fail 0`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/test
git commit -m "Run the integration tests against the real wiring

Same change as the unit suites, minus the db override: these want the real
mongoose plugin and a real connection, and that the suite still passes
without it proves the override is not silently short-circuiting anything.

The per-run database and JWT secret are now assigned in the before hook
rather than inside a builder, because createApp is what triggers the
plugins that read them."
```

---

### Task 6: Update the docs

**Files:**
- Modify: `apps/api/README.md` — the `src/` layout section and the testing section

**Interfaces:**
- Consumes: nothing. Documents the state produced by Tasks 2-5.

- [ ] **Step 1: Find the sections that describe the old wiring**

```bash
cd apps/api && grep -n "autoload\|buildApp\|buildIntegrationApp\|AppOptions\|test/helpers" README.md
```

Expected: at least one hit. The `src/` layout block currently reads
`app.ts  # Fastify options (ajv + ajv-errors + ajv-formats) + AutoLoad for plugins/ & routes/ (dirNameRoutePrefix: true)`.

- [ ] **Step 2: Rewrite the `app.ts` line and add a testing note**

Replace that `app.ts` description with:

```
  app.ts                # explicit plugin registration + createApp() factory; routes via AutoLoad (dirNameRoutePrefix: true)
```

And append to the testing section:

````markdown
### Test wiring

Tests boot the real application through `createApp()` from `#app` — the same
wiring `fastify start` loads. There is no separate test harness.

```ts
const app = await createApp({
  logger: false,
  overrides: {
    oauth: oauthStub,                // stands in for the OIDC discovery fetch
    db: noDb,                        // unit tests stub Mongoose models instead
    rateLimitKey: () => randomUUID() // per-request bucket, budgets unchanged
  }
});
```

Integration tests omit `db` to get a real connection. Plugins are registered
explicitly so that deleting one is a build failure; the coverage test in
`test/app.test.ts` fails if a plugin file is added but not registered.
````

- [ ] **Step 3: Verify no stale references remain anywhere in the repo**

```bash
cd /home/alex/DevConnector && grep -rn "buildApp\|buildIntegrationApp" --include="*.md" --include="*.ts" . | grep -v node_modules | grep -v "/dist/" | grep -v storybook-static
```

Expected: no output.

- [ ] **Step 4: Run the full verification suite**

```bash
cd /home/alex/DevConnector && pnpm run build && pnpm run check-types && pnpm run lint
cd apps/api && npm run test:unit
cd apps/api && MONGODB_PORT=27018 bash test/bin/mongo-docker.sh start && npm run test:integration && MONGODB_PORT=27018 bash test/bin/mongo-docker.sh stop
cd apps/web && npx vitest run
```

Expected: build 3/3, check-types 3/3, lint clean, api unit 423/423, api integration 20/20, web 21/21.

- [ ] **Step 5: Commit**

```bash
git add apps/api/README.md
git commit -m "Document the createApp test wiring"
```

---

## Self-Review

**Spec coverage.** Every section of the spec maps to a task: the seam and
`createApp` → Task 2; plugin order → Task 2 Step 4; route autoload retained →
Task 2 Step 4; the three overrides → Tasks 2-3; the rate-limiter `keyGenerator`
→ Task 1; harness deletion → Tasks 4-5; the `#hooks` cleanup → Task 2 Step 3;
verification counts → each task's final step plus Task 6 Step 4. The spec's
out-of-scope items (replacing `fastify-cli`, removing autoload entirely, the
`__v` branch) are deliberately untouched.

**Type consistency.** `PluginOverrides` is defined once in Task 2 and consumed
under that name in Tasks 3-5. `createApp` takes
`Partial<FastifyServerOptions> & { overrides?: PluginOverrides }` in its
definition, and every call site in Tasks 2, 4 and 5 passes exactly
`{ logger: false, overrides: { oauth, db, rateLimitKey } }` with the members it
needs. `rateLimitKey` is the `AppOptions` field name; `keyGenerator` is the
plugin's own option name. The two meet at exactly one place — the
`fastify.register(rateLimitPlugin, ...)` call in Task 2 — and nowhere else.

**Counts.** 412 at the start. `test:unit` globs
`test/{auth,posts,profiles,plugins,helpers}/*.test.ts`, so a new test in any of
those five directories runs immediately; Task 2 additionally adds
`"test/*.test.ts"` to the glob, because without it a new root-level test file
is silently skipped and the count would lie. 414 after Task 1 (2 tests in
`test/plugins/rate-limit.test.ts`), 420 after Task 2 (6 in `test/app.test.ts`),
423 after Task 3 (3 in `test/helpers/plugin-overrides.test.ts`), and 423 through
Tasks 4-6. Every count is stated in the task that changes it.

These numbers were wrong in the first draft of this plan, which assumed a new
test in `test/plugins/` would not run and predicted 412/418/420. Task 1's
implementer caught it. The lint constraint was also over-claimed in the same
way: `apps/api` has no `lint` script, so `pnpm run lint` only covers `apps/web`.

**Placeholder scan.** No step defers work. Task 3 Step 6 is a verification step
that deliberately breaks something to prove a guard bites, then reverts it, and
states the revert command and the expected clean state.

**Corrections made during this review, after checking the repo rather than
trusting the draft.** Three defects in the first draft were found and fixed:
the CLI-contract check originally booted a real server, which would have
blocked for 30 seconds on `mongoose.connect` before failing for unrelated
reasons, and is now a fast assertion against `dist/app.js`; the oauth stub was
originally described as giving a compile-time guard, which is impossible because
the route-facing type comes from a `declare module "fastify"` augmentation, so
the guard is now a runtime test that greps `src/routes` and names the missing
method; and the plan originally said to delete `frontendUrl` from all three
integration files, but it is read at lines 169 and 283 of
`test/integration/auth.integration.test.ts`, so it is kept there as a
module-level `const`.

**Review Focus coverage.** All five items are owned: item 1 by Task 2's
CLI-path test and Step 7's contract check; item 2 by Task 2's plugin-coverage
test; item 3 by Task 3's route-grep test plus Step 6 proving it bites; item 4 by
Task 1's paired tests, which fail loudly if the keyer is ignored; item 5 by
Task 4's mandated `logger: false` in all 12 call sites.
