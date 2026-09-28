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
