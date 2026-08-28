import { FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";

export default fp(async (fastify) => {
  fastify.decorate(
    "authenticate",
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
      } catch {
        return reply.status(401).send({
          message: "Unauthorized",
        });
      }

      if (request.user.type !== "access") {
        return reply.status(401).send({
          message: "Unauthorized",
        });
      }
    },
  );
});
