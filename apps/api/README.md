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
* Modern docs (Scalar): http://localhost:4000/reference
* OpenAPI JSON: http://localhost:4000/docs/json (Swagger), http://localhost:4000/reference/openapi.json (Scalar)
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

Registered in `src/plugins/swagger.ts` (loaded via `@fastify/autoload` before `src/routes/`). Both UIs serve the same spec generated dynamically from route schemas (`@fastify/swagger` `openapi: 3.0.3`, `info.title: "DevConnector API"`).

* `GET /docs` — Swagger UI (`@fastify/swagger-ui@^6`, `routePrefix: "/docs"`, `uiConfig.docExpansion: "list"`)
* `GET /reference` — Scalar (`@scalar/fastify-api-reference@^1`, `routePrefix: "/reference"`, `theme: "purple"`, `layout: "modern"`)

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

For clean examples avoid bare `pattern: ".*\\S.*"` without `example`/`examples` — the UI faker will generate gibberish to satisfy the regex. See `src/modules/profile/profile.schemas.ts` for pattern + `example: "Developer"`, top-level `example: { status: "Developer", skills: ["JavaScript","Node.js","React"], ... }`.

To hide a route from docs: `schema: { hide: true }`. To hide untagged routes globally set `hideUntagged: true` in `src/plugins/swagger.ts`.

## Project layout

```
src/
  app.ts                # Fastify options (ajv + ajv-errors + ajv-formats) + AutoLoad for plugins/ & routes/ (dirNameRoutePrefix: true)
  plugins/              # swagger.ts, auth.ts, jwt.ts, cookie.ts, sensible.ts, rate-limit.ts, mongoose.ts, oath.ts
  routes/               # auth/{register,login,refresh,logout,google}, profile/{profile,me,...}, posts/{...}
  modules/{auth,profile,posts,users}/  # *.schemas.ts (TypeBox), *.service.ts, *.model.ts (Mongoose)
  helpers/              # error-handler.ts, auth.ts, auth.cookies.ts
  config/env.ts        # EnvSchema (TypeBox)
```

## Env

Required (`src/config/env.ts`): `JWT_SECRET`, `MONGODB_URI`, `FRONTEND_URL`, `GITHUB_ACCESS_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` (`http://localhost:4000/auth/google/callback`).

## Learn more

* [Fastify](https://fastify.dev/docs/latest/) — [Fastify Swagger](https://github.com/fastify/fastify-swagger), [fastify-swagger-ui](https://github.com/fastify/fastify-swagger-ui), [Scalar Fastify](https://github.com/scalar/scalar/blob/main/documentation/integrations/fastify.md)
* [TypeBox](https://github.com/sinclairzx81/typebox)
