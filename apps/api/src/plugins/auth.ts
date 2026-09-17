import AppError from "#helpers/app-error";
import { FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";

export default fp(async (fastify) => {
  fastify.decorate(
    "authenticate",
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
      } catch {
        throw new AppError(401, "FAILED_AUTHENTICATION", "Unauthorized");
      }

      if (request.user.type !== "access") {
        throw new AppError(401, "FAILED_AUTHENTICATION", "Unauthorized");
      }
    },
  );
});
