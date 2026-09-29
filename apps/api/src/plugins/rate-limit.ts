import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";
import type { FastifyRequest } from "fastify";

/**
 * `keyGenerator` exists so tests can key every request uniquely and never trip
 * a budget; production passes nothing and keeps the plugin's own per-IP
 * keying. The limits below and the per-route `config.rateLimit` overrides in
 * src/routes are the real ones — this seam does not relax them.
 */
export default fp<{ keyGenerator?: (request: FastifyRequest) => string }>(
  async (fastify, opts) => {
    await fastify.register(rateLimit, {
      global: true,
      max: 100,
      timeWindow: "1 minute",
      allowList: ["/", "/docs"],
      enableDraftSpec: true,
      addHeaders: {
        "x-ratelimit-limit": true,
        "x-ratelimit-remaining": true,
        "x-ratelimit-reset": true,
        "retry-after": true,
      },
      addHeadersOnExceeding: {
        "x-ratelimit-limit": true,
        "x-ratelimit-remaining": true,
        "x-ratelimit-reset": true,
      },
      errorResponseBuilder: (_request, context) => {
        return {
          code: "RATE_LIMIT_EXCEEDED",
          message: `Too many requests, please try again after ${context.after}`,
          statusCode: 429,
          retryAfter: context.after,
        };
      },
      keyGenerator: opts.keyGenerator,
    });
  },
);
