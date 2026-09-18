import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import AppError from "#helpers/app-error";

/**
 * Converts application, validation, and unexpected errors into API responses.
 *
 * @param error - Error raised while processing the request.
 * @param request - Fastify request used to log unexpected errors.
 * @param reply - Fastify reply used to send the error response.
 * @returns The completed error response.
 */
export const errorHandler = (
  error: FastifyError | AppError,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      request.log.error(error);
      // Preserve the typed status/code (e.g. 502 GITHUB_UPSTREAM_ERROR) so
      // callers can distinguish upstream failures; only generic Errors
      // become INTERNAL_SERVER_ERROR below.
      return reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
      });
    }
    return reply.status(error.statusCode).send({
      code: error.code,
      message: error.message,
    });
  }

  if (error.validation) {
    const issues = error.validation.map((err) => ({
      path: err.instancePath.replace(/^\//, "").split("/").filter(Boolean),
      field: err.instancePath.replace(/^\//, ""),
      code: err.keyword,
      message: err.message ?? "Invalid value",
    }));
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of issues) {
      const key = issue.field || "_root";
      if (!fieldErrors[key]) fieldErrors[key] = [];
      fieldErrors[key].push(issue.message);
    }
    return reply.status(400).send({
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      issues: issues.map(({ path, code, message }) => ({
        path,
        code,
        message,
      })),
      fieldErrors,
    });
  }

  // Let Fastify handle its own HTTP errors (404, 429, etc.) so headers
  // like retry-after / x-ratelimit-* are preserved.
  if (
    typeof (error as FastifyError).statusCode === "number" &&
    !(error as FastifyError).validation
  ) {
    const statusCode = (error as FastifyError).statusCode as number;
    if (statusCode === 404) {
      return reply
        .status(404)
        .send({ code: "NOT_FOUND", message: "Not found" });
    }
    if (statusCode === 429) {
      // Normalize but preserve rate-limit details; headers set by the
      // rate-limit plugin (retry-after, x-ratelimit-*) stay intact.
      const err = error as FastifyError & {
        code?: string;
        retryAfter?: unknown;
      };
      return reply.status(429).send({
        code: err.code ?? "RATE_LIMIT_EXCEEDED",
        message: error.message ?? "Too many requests",
        ...(typeof err.retryAfter !== "undefined"
          ? { retryAfter: err.retryAfter }
          : {}),
      });
    }
    if (statusCode < 500) {
      const err = error as FastifyError & { code?: string };
      return reply.status(statusCode).send({
        code: err.code ?? "BAD_REQUEST",
        message: error.message ?? "Bad request",
      });
    }
  }

  request.log.error(error);

  return reply.status(500).send({
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal server error",
  });
};
