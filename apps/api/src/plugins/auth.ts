import AppError from "#helpers/app-error";
import { FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
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

      // If the access token carries a sessionId, enforce revocation/expiry.
      // Tokens issued before this change have no sessionId and remain valid until expiry.
      if (request.user.sessionId) {
        const session = await Session.findById(request.user.sessionId).select(
          "+refreshTokenHash",
        );
        if (
          !session ||
          session.revokedAt ||
          session.expiresAt <= new Date() ||
          session.userId.toString() !== request.user.sub
        ) {
          throw new AppError(401, "FAILED_AUTHENTICATION", "Unauthorized");
        }
      }
    },
  );
});
