import Fastify, { type FastifyInstance } from "fastify";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import authPlugin from "#plugins/auth";
import csrfPlugin from "#plugins/csrf";
import { errorHandler } from "#helpers/error-handler";
import { baseOptions, registerRequestIdHook } from "#helpers/request-id";
import mongoose from "mongoose";
import AjvErrors from "ajv-errors";
import addFormats from "ajv-formats";
import Session from "#modules/auth/session.model";
import { Types } from "mongoose";
import {
  lookupSessionUser,
  mkQuery,
  newId,
  recordSessionToken,
  stubMethod,
} from "./stubs.ts";
import registerRoute from "#routes/auth/register";
import loginRoute from "#routes/auth/login";
import refreshRoute from "#routes/auth/refresh";
import logoutRoute from "#routes/auth/logout";
import logoutAllRoute from "#routes/auth/logout-all";
import googleRoute from "#routes/auth/google";
import linkGoogleRoute from "#routes/auth/link-google";
import profileRoute from "#routes/profiles/profiles";
import meRoute from "#routes/profiles/me";
import getByIdRoute from "#routes/profiles/get-by-id";
import deleteExperienceRoute from "#routes/profiles/delete-experience";
import deleteEducationRoute from "#routes/profiles/delete-education";
import addExperienceRoute from "#routes/profiles/add-experience";
import addEducationRoute from "#routes/profiles/add-education";
import getGithubReposRoute from "#routes/profiles/get-github-repos";
import addPostRoute from "#routes/posts/add-post";
import getPostRoute from "#routes/posts/get-post";
import getPostsRoute from "#routes/posts/get-posts";
import deletePostRoute from "#routes/posts/delete-post";
import likeRoute from "#routes/posts/like";
import getCommentsRoute from "#routes/posts/get-comments";
import addCommentRoute from "#routes/posts/add-comment";
import deleteCommentRoute from "#routes/posts/delete-comment";
import updateCommentRoute from "#routes/posts/update-comment";

const AUTH_PREFIX = "/auth";
const PROFILE_PREFIX = "/profiles";
const POSTS_PREFIX = "/posts";

/** Every route the app exposes, in the order autoload registers them.
 *  `any` on the plugin slot: the TypeBox provider makes a typed tuple
 *  invariant-incompatible with `app.register`. */
const ROUTES: Array<[string, any]> = [
  [AUTH_PREFIX, registerRoute],
  [AUTH_PREFIX, loginRoute],
  [AUTH_PREFIX, refreshRoute],
  [AUTH_PREFIX, logoutRoute],
  [AUTH_PREFIX, logoutAllRoute],
  [AUTH_PREFIX, googleRoute],
  [AUTH_PREFIX, linkGoogleRoute],
  [PROFILE_PREFIX, profileRoute],
  [PROFILE_PREFIX, meRoute],
  [PROFILE_PREFIX, getByIdRoute],
  [PROFILE_PREFIX, deleteExperienceRoute],
  [PROFILE_PREFIX, deleteEducationRoute],
  [PROFILE_PREFIX, addExperienceRoute],
  [PROFILE_PREFIX, addEducationRoute],
  [PROFILE_PREFIX, getGithubReposRoute],
  [POSTS_PREFIX, addPostRoute],
  [POSTS_PREFIX, getPostRoute],
  [POSTS_PREFIX, getPostsRoute],
  [POSTS_PREFIX, deletePostRoute],
  [POSTS_PREFIX, likeRoute],
  [POSTS_PREFIX, getCommentsRoute],
  [POSTS_PREFIX, addCommentRoute],
  [POSTS_PREFIX, deleteCommentRoute],
  [POSTS_PREFIX, updateCommentRoute],
];

const GOOGLE_STUB = {
  getAccessTokenFromAuthorizationCodeFlow: async () => ({
    token: { access_token: "google-access-token", token_type: "Bearer" },
  }),
};

export interface BuildAppOptions {
  /** Mount the real route handlers. Off by default: most unit tests only
   *  need the auth plugin. */
  withRoutes?: boolean;
  /** Enable the CSRF origin check. */
  withCsrf?: boolean;
  /** Decorate `googleOAuth2` with a stub instead of the real OAuth plugin. */
  stubGoogle?: boolean;
  /** Register the mongoose plugin and connect to `mongoUri`. */
  mongoUri?: string;
  /** JWT signing secret. Defaults to a fixed test secret. */
  jwtSecret?: string;
  /** Extra wrapper around the error handler, for harness bookkeeping. */
  wrapErrorHandler?: (
    handler: typeof errorHandler,
    app: FastifyInstance,
  ) => Parameters<FastifyInstance["setErrorHandler"]>[0];
}

export async function buildApp({
  withRoutes = false,
  withCsrf = false,
  stubGoogle = false,
  mongoUri,
  jwtSecret = "test-jwt-secret",
  wrapErrorHandler,
}: BuildAppOptions = {}): Promise<FastifyInstance> {
  if (mongoUri) {
    // env.ts validates at import, so every required var must be set first.
    process.env.MONGODB_URI = mongoUri;
    process.env.JWT_SECRET = jwtSecret;
    process.env.GITHUB_ACCESS_TOKEN ??= "integration-test-token";
    process.env.GOOGLE_CLIENT_SECRET ??= "integration-test-secret";
    process.env.GOOGLE_CLIENT_ID ??= "integration-test-id";
    process.env.GOOGLE_CALLBACK_URL ??=
      "http://localhost:3000/auth/google/callback";
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }

  const app = Fastify({
    logger: false,
    routerOptions: { ignoreTrailingSlash: true },
    ...baseOptions,
    ajv: {
      customOptions: { coerceTypes: false, allErrors: true, strict: false },
      plugins: [AjvErrors as any, addFormats as any],
    },
  });

  await app.register(cookie);
  await app.register(jwt, {
    secret: jwtSecret,
    sign: { algorithm: "HS256" },
    cookie: { cookieName: "access_token", signed: false },
  });
  await app.register(authPlugin);
  if (withCsrf) await app.register(csrfPlugin);

  if (mongoUri) {
    const { default: mongoosePlugin } = await import("#plugins/mongoose");
    await app.register(mongoosePlugin);
  }

  registerRequestIdHook(app);
  app.setErrorHandler(
    wrapErrorHandler ? wrapErrorHandler(errorHandler, app) : errorHandler,
  );

  // The unit-test builder never loads the real OAuth plugin, so any route that
  // needs the namespace gets the stub.
  if (stubGoogle || withRoutes) {
    app.decorate("googleOAuth2", GOOGLE_STUB as any);
  }

  if (withRoutes) {
    for (const [prefix, route] of ROUTES) {
      app.register(route, { prefix });
    }
    app.get(
      "/protected",
      { onRequest: [app.authenticate] },
      async () => ({ ok: true }),
    );
  }

  await app.ready();
  return app;
}

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
