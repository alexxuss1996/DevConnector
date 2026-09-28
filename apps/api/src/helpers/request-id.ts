import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyServerOptions } from "fastify";

/**
 * Honours an inbound `x-request-id` so a client-supplied id shows up in logs
 * and error bodies; otherwise one is generated.
 *
 * The value is bounded and shape-checked: it is written into every log line
 * for the request and echoed back to the caller, so an unvalidated header
 * would let anyone forge a correlation id or flood the log stream.
 */
export function genReqId(request: {
  headers: Record<string, unknown>;
}): string {
  const inbound = request.headers["x-request-id"];
  return typeof inbound === "string" && /^[\w-]{1,64}$/.test(inbound)
    ? inbound
    : randomUUID();
}

/** Server options shared by the real app and the test harnesses. */
export const baseOptions = {
  genReqId,
} satisfies Pick<FastifyServerOptions, "genReqId">;

/**
 * Echoes the request id back so callers can quote it when reporting a failure.
 *
 * Exported so the test harnesses mount the same hook as production — a
 * hand-picked harness drifts, and a regression here would otherwise be
 * invisible to every test.
 */
export function registerRequestIdHook(fastify: FastifyInstance): void {
  fastify.addHook("onSend", async (request, reply, payload) => {
    void reply.header("x-request-id", request.id);
    return payload;
  });
}

/**
 * Cache policy for the unauthenticated profile reads.
 *
 * `public` is only correct while these routes stay unauthenticated — adding
 * auth to one without also dropping this (or adding `Vary: Authorization`)
 * would let a shared cache serve one user's profile to another. `/profiles/me`
 * deliberately has no cache header.
 */
export const PUBLIC_CACHE_CONTROL =
  "public, max-age=60, stale-while-revalidate=300";
