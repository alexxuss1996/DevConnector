# DevConnector API

Fastify 5 + TypeBox + Mongoose backend for DevConnector — a social network for developers. bootstrapped with `fastify-cli`.

## Quick start

```sh
pnpm install
cp .env.example .env   # set JWT_SECRET, MONGODB_URI, GOOGLE_*, GITHUB_ACCESS_TOKEN, FRONTEND_URL
pnpm --filter api dev        # or pnpm dev from repo root via turbo
```

* API: http://localhost:4000
* Interactive docs (Swagger UI): http://localhost:4000/docs
* OpenAPI JSON: http://localhost:4000/docs/json
* OpenAPI YAML: http://localhost:4000/docs/yaml

`npm start` / `pnpm start` runs production build on port `4000` (`fastify start -p 4000 dist/app.js`).

## Available scripts

| script | description |
|---|---|
| `pnpm dev` | `tsc -w` + `fastify start --watch` on `4000` |
| `pnpm start` | clean + build + `fastify start -p 4000 dist/app.js` |
| `pnpm run build:ts` | `tsc` to `dist/` |
| `pnpm test` | `build:ts` + `tsc -p test/tsconfig.json` + `c8 node --test` |

## Interactive documentation

Configured in `src/plugins/swagger.ts` and registered explicitly in `src/app.ts`, after the other plugins and before the routes. The UI serves the spec generated dynamically from route schemas (`@fastify/swagger` `openapi: 3.0.3`, `info.title: "DevConnector API"`).
* `GET /docs` — Swagger UI (`@fastify/swagger-ui@^6`, `routePrefix: "/docs"`, `uiConfig.docExpansion: "list"`)

Security schemes exposed in OpenAPI:
* `bearerAuth` — `Authorization: Bearer <accessToken>` (from `POST /auth/login` / `/auth/register`)
* `cookieAuth` — `refreshToken` httpOnly cookie

### Adding docs for a new route

Schemas are JSON-Schema via TypeBox (`typebox@1.3.15` + `@fastify/type-provider-typebox`). The spec is inferred, but `tags`/`summary`/`description`/`response`/`security` improve grouping and Try-It-Out.

```ts
// src/routes/posts/add-post.ts
fastify.post("/", {
  onRequest: [fastify.authenticate],
  schema: {
    tags: ["Posts"],
    summary: "Create a post",
    description: "Requires bearerAuth",
    security: [{ bearerAuth: [] }],
    body: CreatePostSchema,          // TypeBox -> JSON Schema
    response: { 200: { description: "Created", type: "object", properties: { _id: {type:"string"} } } }
  }
}, handler)
```

For clean examples avoid bare `pattern: ".*\\S.*"` without `example`/`examples` — the UI faker will generate gibberish to satisfy the regex. See `src/modules/profiles/profiles.schemas.ts` for pattern + `example: "Developer"`, top-level `example: { status: "Developer", skills: ["JavaScript","Node.js","React"], ... }`.

To hide a route from docs: `schema: { hide: true }`. To hide untagged routes globally set `hideUntagged: true` in `src/plugins/swagger.ts`.

## Project layout

```
src/
  app.ts                # explicit plugin registration + createApp() factory; routes via AutoLoad (dirNameRoutePrefix: true)
  plugins/              # auth, cookie, cors, csrf, helmet, jwt, mongoose, oauth, rate-limit, swagger — registered explicitly in app.ts, in that order
  routes/               # auth/{register,login,refresh,logout,logout-all,google,link-google}, profiles/{profiles,me,...}, posts/{...}
  modules/{auth,profiles,posts,users}/  # *.service.ts, *.model.ts (Mongoose), *.schemas.ts
  helpers/              # error-handler.ts, auth.ts, auth.cookies.ts
  config/env.ts        # EnvSchema (TypeBox)
```

## Test wiring

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

`extraRoutes` adds test-only routes. It runs inside the app before it readies,
which is why it is an override and not a call on the returned instance.

## Env

Required (`src/config/env.ts`): `JWT_SECRET`, `MONGODB_URI`, `FRONTEND_URL`, `GITHUB_ACCESS_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` (`http://localhost:4000/auth/google/callback`).

## Learn more

* [Fastify](https://fastify.dev/docs/latest/) — [Fastify Swagger](https://github.com/fastify/fastify-swagger), [fastify-swagger-ui](https://github.com/fastify/fastify-swagger-ui)
* [TypeBox](https://github.com/sinclairzx81/typebox)
