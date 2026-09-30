import fp from "fastify-plugin";
import fastifyCookie from "@fastify/cookie";
import { createHmac } from "node:crypto";
import env from "#config/env";

export default fp(async (fastify) => {
  // A cookie signature is HMAC(secret, value) and a JWT signature is
  // HMAC(secret, "header.payload") — the same construction. Reusing
  // JWT_SECRET here would therefore make every valid JWT a validly-signed
  // cookie, so any registered user could mint the OAuth state cookie that
  // plugins/oauth.ts signs to prevent login CSRF. Derive a separate key so the
  // two signature domains stay independent; both still rotate together.
  const cookieSecret = createHmac("sha256", env.JWT_SECRET)
    .update("cookie-signing")
    .digest("hex");

  await fastify.register(fastifyCookie, {
    // Required, not optional: @fastify/cookie only decorates `signCookie` /
    // `unsignCookie` when a secret is present. plugins/oauth.ts signs the OAuth
    // state and PKCE verifier cookies with `cookie: { signed: true }` so they
    // cannot be forged, and that check unsigns them again — without a secret
    // here it would reject every callback and break sign-in.
    secret: cookieSecret,
  });
});
