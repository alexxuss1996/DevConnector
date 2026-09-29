import fp from "fastify-plugin";
import oauthPlugin from "@fastify/oauth2";
import env from "#config/env";

export default fp(async (fastify) => {
  await fastify.register(oauthPlugin, {
    name: "googleOAuth2",

    scope: ["openid", "profile", "email"],

    credentials: {
      client: {
        id: env.GOOGLE_CLIENT_ID,
        secret: env.GOOGLE_CLIENT_SECRET,
      },
    },

    discovery: {
      issuer: "https://accounts.google.com",
    },

    // Note: global path (not under /auth prefix) to avoid colliding with
    // routes/auth/* which mounts GET /auth/google/callback.
    startRedirectPath: "/auth/google",
    callbackUri: env.GOOGLE_CALLBACK_URL,

    pkce: "S256",

    // Sign the state and PKCE verifier cookies. Without this the callback's
    // state check only proves that the query `state` matches the state cookie,
    // so anyone who can write a cookie for this host — an on-path attacker, a
    // sibling subdomain — can plant both values and force a login CSRF. Signing
    // makes them unforgeable; plugins/cookie.ts supplies the secret this needs.
    //
    // `hostPrefixedCookies: true` would additionally switch to `__Host-` names
    // to close the write vector at the browser. Left off because it forces
    // `Secure`, so it is a deployment decision, not a safe default.
    cookie: { signed: true },
  });
});
