import fp from "fastify-plugin";
import oauthPlugin from "@fastify/oauth2";
import env from "#config/env";

export default fp(async (fastify) => {
  await fastify.register(oauthPlugin, {
    name: "googleOAuth2",

    scope: ["openid", "profile", "email"],

    credentials: {
      client: {
        id: env.GOOGLE_CLIENT_ID!,
        secret: env.GOOGLE_CLIENT_SECRET!,
      },
    },

    discovery: {
      issuer: "https://accounts.google.com",
    },

    startRedirectPath: "/auth/google",
    callbackUri: env.GOOGLE_CALLBACK_URL!,

    pkce: "S256",
  });
});
