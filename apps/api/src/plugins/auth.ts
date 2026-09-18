import AppError from "#helpers/app-error";
import { FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { Types } from "mongoose";
import Session from "#modules/auth/session.model";

export default fp(async (fastify) => {
  fastify.decorate(
    "authenticate",
    async function (request: FastifyRequest, _reply: FastifyReply) {
      try {
        await request.jwtVerify();
      } catch {
        throw new AppError(401, "FAILED_AUTHENTICATION", "Unauthorized");
      }

      if (request.user.type !== "access") {
        throw new AppError(401, "FAILED_AUTHENTICATION", "Unauthorized");
      }

      // Every access token must carry a sessionId so logout/revocation is
      // enforceable. Tokens without one are rejected.
      if (!request.user.sessionId) {
        throw new AppError(401, "FAILED_AUTHENTICATION", "Unauthorized");
      }
      if (
        !Types.ObjectId.isValid(request.user.sessionId) ||
        !Types.ObjectId.isValid(request.user.sub)
      ) {
        throw new AppError(401, "FAILED_AUTHENTICATION", "Unauthorized");
      }
      // NOTE: only userId is needed here (no token hash check on the
      // access path); avoids pulling the argon2 hash on every request.
      const session = await Session.findById(request.user.sessionId).select(
        "+userId",
      );
      if (
        !session ||
        !session.userId ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        session.userId.toString() !== request.user.sub
      ) {
        throw new AppError(401, "FAILED_AUTHENTICATION", "Unauthorized");
      }
    },
  );
});
