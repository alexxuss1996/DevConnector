import type { FastifyInstance } from "fastify";
import mongoose from "mongoose";

/**
 * Integration tests always run against the local MongoDB, even if MONGODB_URI
 * points at Atlas in .env. Keeps only the first host and the database name —
 * Atlas query params (ssl, replicaSet, authSource) are cluster-specific and
 * break local, and local mongo has no credentials to authenticate with.
 *
 * The scheme, optional credentials and host list are matched by hand rather
 * than by `new URL`, which rejects the comma-separated host list that the
 * Atlas example in .env.example uses.
 */
export function toLocalMongoUri(uri: string): string {
  const parsed = /^(mongodb(?:\+srv)?:\/\/)(?:[^@/]*@)?([^/?]+)(.*)$/.exec(uri);
  if (!parsed) throw new Error(`Cannot parse MONGODB_URI: ${uri}`);
  // A replica-set host list is comma-separated, and the database name follows
  // the last host, so split the authority off before looking at the path.
  const [host] = parsed[2].split(",");
  const db = parsed[3].split("?")[0].replace(/^\//, "");
  return `${parsed[1]}${host}/${db || "devconnector_test"}`;
}

/** Appends a suffix to the database name, for per-run test isolation. */
export function appendDbSuffix(uri: string, suffix: string): string {
  const parsed = /^(mongodb(?:\+srv)?:\/\/)(?:[^@/]*@)?([^/?]+)(.*)$/.exec(uri);
  if (!parsed) throw new Error(`Cannot parse MONGODB_URI: ${uri}`);
  const [host] = parsed[2].split(",");
  const db = parsed[3].split("?")[0].replace(/^\//, "");
  return `${parsed[1]}${host}/${db ? `${db}_${suffix}` : `_${suffix}`}`;
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
