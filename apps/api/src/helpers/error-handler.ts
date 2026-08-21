import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import AppError from "#helpers/app-error";

export const errorHandler = async (
  error: FastifyError | AppError,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      code: error.code,
      message: error.message,
    });
  } else if (error.validation) {
    return reply.status(400).send({
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      errors: error.validation.map((error) => ({
        field: error.instancePath.replace(/^\//, ""),
        keyword: error.keyword,
        message: error.message ?? "Invalid value",
      })),
    });
  }

  request.log.error(error);

  return reply.status(500).send({
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal server error",
  });
};
