import fp from "fastify-plugin";
import fastifyCookie from "@fastify/cookie";
import env from "#config/env";

export default fp(async (fastify) => {
  await fastify.register(fastifyCookie, {
    // Required, not optional: @fastify/cookie only decorates `signCookie` /
    // `unsignCookie` when a secret is present. plugins/oauth.ts signs the OAuth
    // state and PKCE verifier cookies with `cookie: { signed: true }` so they
    // cannot be forged, and that check unsigns them again — without a secret
    // here it would reject every callback and break sign-in.
    secret: env.JWT_SECRET,
  });
});
