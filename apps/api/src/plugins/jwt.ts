import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import { FastifyPluginAsync } from "fastify";
export default fp<FastifyPluginAsync>(async (fastify, opts): Promise<void> => {
  fastify.register(jwt, {
    secret: process.env.JWT_SECRET!,
    sign: {
      algorithm: "HS256",
    },
  });
});
