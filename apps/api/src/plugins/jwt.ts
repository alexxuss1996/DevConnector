import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import { FastifyPluginAsync } from "fastify";
import env from "#config/env";
export default fp<FastifyPluginAsync>(async (fastify, opts): Promise<void> => {
  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: "access_token",
      signed: false,
    },
    sign: {
      algorithm: "HS256",
      expiresIn: "15m",
    },
  });
});
