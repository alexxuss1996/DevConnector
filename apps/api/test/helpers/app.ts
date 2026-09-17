import Fastify from "fastify";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import sensible from "@fastify/sensible";
import type { OAuth2Namespace } from "@fastify/oauth2";
import authPlugin from "#plugins/auth";
import registerRoute from "#routes/auth/register";
import loginRoute from "#routes/auth/login";
import refreshRoute from "#routes/auth/refresh";
import logoutRoute from "#routes/auth/logout";
import googleRoute from "#routes/auth/google";
import profileRoute from "#routes/profile/profile";
import meRoute from "#routes/profile/me";
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
import { errorHandler } from "#helpers/error-handler";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const AjvErrors = require("ajv-errors");
const addFormats = require("ajv-formats");

const AUTH_PREFIX = "/auth";
const PROFILE_PREFIX = "/profile";
const POSTS_PREFIX = "/posts";

export async function buildApp({
  withRoutes = false,
}: { withRoutes?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    ajv: { customOptions: { coerceTypes: false, allErrors: true, strict: false }, plugins: [AjvErrors, addFormats] },
  });

  await app.register(cookie);
  await app.register(jwt, {
    secret: "test-jwt-secret",
    sign: { algorithm: "HS256" },
    cookie: { cookieName: "access_token", signed: false },
  });
  await app.register(sensible);
  await app.register(authPlugin);
  app.setErrorHandler(errorHandler);

  if (withRoutes) {
    await app.decorate("googleOAuth2", {
      getAccessTokenFromAuthorizationCodeFlow: async () => ({
        token: { access_token: "google-access-token", token_type: "Bearer" },
      }),
    } as unknown as OAuth2Namespace);

    app.register(registerRoute, { prefix: AUTH_PREFIX });
    app.register(loginRoute, { prefix: AUTH_PREFIX });
    app.register(refreshRoute, { prefix: AUTH_PREFIX });
    app.register(logoutRoute, { prefix: AUTH_PREFIX });
    app.register(googleRoute, { prefix: AUTH_PREFIX });
    app.register(profileRoute, { prefix: PROFILE_PREFIX });
    app.register(meRoute, { prefix: PROFILE_PREFIX });
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

    app.get(
      "/protected",
      { onRequest: [app.authenticate] },
      async (_request: FastifyRequest, reply: FastifyReply) => {
        return reply.send({ ok: true });
      },
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

export function signAccessToken(
  app: FastifyInstance,
  payload: Partial<AuthPayload> & Record<string, unknown> = {},
): string {
  return app.jwt.sign({ type: "access", ...payload } as AuthPayload, {
    expiresIn: "15m",
  });
}

export function signRefreshToken(
  app: FastifyInstance,
  payload: Partial<AuthPayload> & Record<string, unknown>,
): string {
  return app.jwt.sign({ type: "refresh", ...payload } as AuthPayload, {
    expiresIn: "30d",
  });
}
