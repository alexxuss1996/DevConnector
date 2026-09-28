import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import env from "#config/env";
export default fp(async (fastify) => {
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
