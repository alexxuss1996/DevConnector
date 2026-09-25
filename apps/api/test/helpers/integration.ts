import Fastify from "fastify";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import sensible from "@fastify/sensible";
import authPlugin from "#plugins/auth";
import csrfPlugin from "#plugins/csrf";
import { errorHandler } from "#helpers/error-handler";
import mongoose from "mongoose";
import AjvErrors from "ajv-errors";
import addFormats from "ajv-formats";

import registerRoute from "#routes/auth/register";
import loginRoute from "#routes/auth/login";
import refreshRoute from "#routes/auth/refresh";
import logoutRoute from "#routes/auth/logout";
import logoutAllRoute from "#routes/auth/logout-all";
import googleRoute from "#routes/auth/google";
import linkGoogleRoute from "#routes/auth/link-google";
import profileRoute from "#routes/profile/profile";
import meRoute from "#routes/profile/me";
import getByIdRoute from "#routes/profile/get-by-id";
import deleteExperienceRoute from "#routes/profile/delete-experience";
import deleteEducationRoute from "#routes/profile/delete-education";
import addExperienceRoute from "#routes/profile/add-experience";
import addEducationRoute from "#routes/profile/add-education";
import getGithubReposRoute from "#routes/profile/get-github-repos";
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
const PROFILE_PREFIX = "/profile";
const POSTS_PREFIX = "/posts";

export interface IntegrationAppOptions {
  /** MongoDB connection URI for the integration database. */
  mongoUri: string;
  /** JWT secret for the test server. */
  jwtSecret: string;
  /** Frontend URL used by OAuth redirect and CSRF origin check. */
  frontendUrl: string;
  /** Whether to stub the Google OAuth2 namespace (no real Google flow). */
  stubGoogle?: boolean;
  /** Optional suffix to append to the database name for test isolation. */
  dbNameSuffix?: string;
}

/**
 * Integration tests always run against the local MongoDB on localhost:27018,
 * even if MONGODB_URI points to Atlas in .env. Rewrites any URI to use the
 * local host, preserving only the database name (Atlas query params like
 * ssl/replicaSet are stripped — they're cluster-specific and break local).
 */
function toLocalMongoUri(uri: string): string {
  // Strip query params — they're cluster-specific (ssl, replicaSet, authSource)
  const qIdx = uri.indexOf("?");
  const base = qIdx >= 0 ? uri.slice(0, qIdx) : uri;

  // Preserve the host from the input URI (don't hardcode localhost —
  // in WSL2, localhost resolves to ::1 which Docker doesn't bind to).
  const hostIdx = base.indexOf("://");
  const hostStart = hostIdx >= 0 ? hostIdx + 3 : 0;
  const hostEnd = base.indexOf("/", hostStart);
  const host =
    hostEnd >= 0 ? base.slice(hostStart, hostEnd) : base.slice(hostStart);

  // Find the db name (after the last slash before query/end)
  const lastSlash = base.lastIndexOf("/");
  const hasDbName = lastSlash >= 0 && lastSlash < base.length - 1;
  const dbName = hasDbName ? base.slice(lastSlash + 1) : "devconnector_test";

  return `mongodb://${host}/${dbName}`;
}

export async function buildIntegrationApp({
  mongoUri,
  jwtSecret,
  frontendUrl,
  stubGoogle = true,
  dbNameSuffix,
}: IntegrationAppOptions): Promise<Fastify.FastifyInstance> {
  // Always use local MongoDB — integration tests must not hit Atlas
  mongoUri = toLocalMongoUri(mongoUri);

  // Append suffix to db name if provided (for test isolation)
  if (dbNameSuffix) {
    mongoUri = appendDbSuffix(mongoUri, dbNameSuffix);
  }

  // Set env vars the app expects before importing mongoose plugin.
  // The env.ts module checks all required vars at import time, so set all of them.
  process.env.MONGODB_URI = mongoUri;
  process.env.JWT_SECRET = jwtSecret;
  process.env.FRONTEND_URL = frontendUrl;

  process.env.GITHUB_ACCESS_TOKEN =
    process.env.GITHUB_ACCESS_TOKEN || "integration-test-token";
  process.env.GOOGLE_CLIENT_SECRET =
    process.env.GOOGLE_CLIENT_SECRET || "integration-test-secret";
  process.env.GOOGLE_CLIENT_ID =
    process.env.GOOGLE_CLIENT_ID || "integration-test-id";
  process.env.GOOGLE_CALLBACK_URL =
    process.env.GOOGLE_CALLBACK_URL ||
    "http://localhost:3000/auth/google/callback";

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  const app = Fastify({
    logger: false,
    routerOptions: {
      ignoreTrailingSlash: true,
    },
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
  await app.register(sensible);
  await app.register(authPlugin);
  await app.register(csrfPlugin);

  // Load mongoose plugin — connects to the real DB.
  await app.register(async () => {
    const { default: mongoosePlugin } = await import("#plugins/mongoose");
    await mongoosePlugin(app as any);
  });

  app.setErrorHandler((error: any, request: any, reply: any) => {
    if (reply.sent || reply.finished) return;
    request.log.error(error);
    (app as any).lastError = error;
    return errorHandler(error, request, reply);
  });

  // Re-declare googleOAuth2 decorator type if stubbed.
  if (stubGoogle) {
    const existing = (app as any).googleOAuth2;
    if (!existing || !existing.getAccessTokenFromAuthorizationCodeFlow) {
      (app as any).googleOAuth2 = {
        getAccessTokenFromAuthorizationCodeFlow: async () => ({
          token: {
            access_token: "google-access-token",
            token_type: "Bearer",
          },
        }),
      };
    }
  }

  app.register(registerRoute, { prefix: AUTH_PREFIX });
  app.register(loginRoute, { prefix: AUTH_PREFIX });
  app.register(refreshRoute, { prefix: AUTH_PREFIX });
  app.register(logoutRoute, { prefix: AUTH_PREFIX });
  app.register(logoutAllRoute, { prefix: AUTH_PREFIX });
  app.register(googleRoute, { prefix: AUTH_PREFIX });
  app.register(linkGoogleRoute, { prefix: AUTH_PREFIX });
  app.register(profileRoute, { prefix: PROFILE_PREFIX });
  app.register(meRoute, { prefix: PROFILE_PREFIX });
  app.register(getByIdRoute, { prefix: PROFILE_PREFIX });
  app.register(deleteExperienceRoute, { prefix: PROFILE_PREFIX });
  app.register(deleteEducationRoute, { prefix: PROFILE_PREFIX });
  app.register(addExperienceRoute, { prefix: PROFILE_PREFIX });
  app.register(addEducationRoute, { prefix: PROFILE_PREFIX });
  app.register(getGithubReposRoute, { prefix: PROFILE_PREFIX });
  app.register(addPostRoute, { prefix: POSTS_PREFIX });
  app.register(getPostRoute, { prefix: POSTS_PREFIX });
  app.register(getPostsRoute, { prefix: POSTS_PREFIX });
  app.register(deletePostRoute, { prefix: POSTS_PREFIX });
  app.register(likeRoute, { prefix: POSTS_PREFIX });
  app.register(getCommentsRoute, { prefix: POSTS_PREFIX });
  app.register(addCommentRoute, { prefix: POSTS_PREFIX });
  app.register(deleteCommentRoute, { prefix: POSTS_PREFIX });
  app.register(updateCommentRoute, { prefix: POSTS_PREFIX });

  await app.ready();
  return app as any;
}

/** Appends a suffix to the database name in a MongoDB URI. Works for both simple (mongodb://host/db) and Atlas (mongodb://user@host/?opts) URIs. */
export function appendDbSuffix(uri: string, suffix: string): string {
  // Separate query string (everything from ? onwards)
  const qIdx = uri.indexOf("?");
  const base = qIdx >= 0 ? uri.slice(0, qIdx) : uri;
  const query = qIdx >= 0 ? uri.slice(qIdx) : "";

  // Check if there's a db name: for Atlas URIs like mongodb://user@host1,host2,host3/, there's no db name
  // (the only slash is trailing before query/end). For simple URIs like mongodb://host:port/db, there is one.
  const atIdx = base.indexOf("@");
  const pathStart =
    atIdx >= 0
      ? base.indexOf("/", atIdx)
      : base.indexOf("/", base.indexOf("://") + 3);
  const hasDbName = pathStart >= 0 && pathStart < base.length - 1;

  if (hasDbName) {
    // Append suffix to existing db name
    return (
      base.slice(0, pathStart + 1) +
      base.slice(pathStart + 1) +
      "_" +
      suffix +
      query
    );
  } else {
    // Insert new db name after the host section (before query or end)
    return base + "_" + suffix + query;
  }
}

export async function cleanDb(app: Fastify.FastifyInstance): Promise<void> {
  const conn = (app as unknown as { db: mongoose.Connection }).db;
  if (!conn) throw new Error("Db decorator not available");
  const collections = Object.values(conn.collections) as mongoose.Collection[];
  for (const coll of collections) {
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
