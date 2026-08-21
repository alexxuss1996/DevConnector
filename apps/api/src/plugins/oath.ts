import fp from "fastify-plugin";
import oauthPlugin from "@fastify/oauth2";

export default fp(async (fastify) => {
  await fastify.register(oauthPlugin, {
    name: "googleOAuth2",

    scope: ["openid", "profile", "email"],

    credentials: {
      client: {
        id: process.env.GOOGLE_CLIENT_ID!,
        secret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    },

    discovery: {
      issuer: "https://accounts.google.com",
    },

    startRedirectPath: "/auth/google",
    callbackUri: process.env.GOOGLE_CALLBACK_URL!,

    pkce: "S256",
  });
});
