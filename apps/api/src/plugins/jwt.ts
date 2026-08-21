import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import { FastifyPluginAsync } from "fastify";
export default fp<FastifyPluginAsync>(async (fastify, opts): Promise<void> => {
  fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET!,
    cookie: {
      cookieName: "access_token",
      signed: false,
    },
    sign: {
      algorithm: "HS256",
    },
  });
});
