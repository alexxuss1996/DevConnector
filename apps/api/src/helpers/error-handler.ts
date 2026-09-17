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
export const errorHandler = async (
  error: FastifyError | AppError,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  if (error instanceof AppError || (typeof (error as any).statusCode === "number" && typeof (error as any).code === "string" && !(error as any).validation)) {
    const statusCode = (error as any).statusCode as number;
    const code = (error as any).code as string;
    const message = (error as any).message as string;
    return reply.status(statusCode).send({
      code,
      message,
    });
  } else if (error.validation) {
    const issues = error.validation.map((err) => ({
      path: err.instancePath.replace(/^\//, "").split("/").filter(Boolean),
      field: err.instancePath.replace(/^\//, ""),
      code: err.keyword,
      message: err.message ?? "Invalid value",
      // ajv-errors may put custom message in params
      params: (err as any).params,
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
      // legacy
      errors: issues.map(({ field, code, message }) => ({ field, keyword: code, message })),
      // Zod-like
      issues: issues.map(({ path, code, message }) => ({ path, code, message })),
      fieldErrors,
    });
  }

  request.log.error(error);

  return reply.status(500).send({
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal server error",
  });
};
