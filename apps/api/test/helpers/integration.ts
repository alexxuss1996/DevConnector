import type { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { buildApp, type BuildAppOptions } from "./app.ts";

export { buildApp };
export type { BuildAppOptions };

/**
 * Integration tests always run against the local MongoDB, even if MONGODB_URI
 * points at Atlas in .env. Keeps only the host and the database name — Atlas
 * query params (ssl, replicaSet, authSource) are cluster-specific and break
 * local, and local mongo has no credentials to authenticate with.
 */
function toLocalMongoUri(uri: string): string {
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

export async function buildIntegrationApp(
  options: Omit<BuildAppOptions, "mongoUri" | "wrapErrorHandler"> & {
    mongoUri: string;
    /** Frontend URL used by the OAuth redirect and the CSRF origin check. */
    frontendUrl: string;
    /** Appended to the database name so parallel runs don't collide. */
    dbNameSuffix?: string;
  },
): Promise<FastifyInstance> {
  const { mongoUri, frontendUrl, dbNameSuffix, ...rest } = options;
  process.env.FRONTEND_URL = frontendUrl;

  return buildApp({
    ...rest,
    withRoutes: true,
    withCsrf: true,
    stubGoogle: true,
    mongoUri: appendDbSuffix(toLocalMongoUri(mongoUri), dbNameSuffix ?? "test"),
    // Stash the error on the app so a failing assertion can print it.
    wrapErrorHandler: (handler, app) => (error, request, reply) => {
      if (reply.sent || (reply as any).finished) return;
      request.log.error(error);
      (app as any).lastError = error;
      return handler(error as any, request, reply);
    },
  });
}

export async function cleanDb(app: FastifyInstance): Promise<void> {
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
