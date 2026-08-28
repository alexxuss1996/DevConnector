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
import { errorHandler } from "#helpers/error-handler";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

const AUTH_PREFIX = "/auth";

export async function buildApp({
  withRoutes = false,
}: { withRoutes?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

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
