import { FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { randomUUID } from "node:crypto";

export default fp(async (fastify) => {
  fastify.addHook("onReady", async () => {
    const sign = fastify.jwt.sign.bind(fastify.jwt) as (
      payload: Record<string, unknown>,
      options?: any,
    ) => string;

    fastify.jwt.sign = ((payload: Record<string, unknown>, options?: any) =>
      sign(
        { jti: randomUUID(), ...payload },
        options,
      )) as typeof fastify.jwt.sign;
  });

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
