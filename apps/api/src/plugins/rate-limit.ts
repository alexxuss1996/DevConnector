import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";

export default fp(async (fastify) => {
  // Skip rate limiting in test env if explicitly disabled (tests use buildApp helper without this plugin)
  // but keep for production/dist usage via Autoload.
  await fastify.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: "1 minute",
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
  });
});
