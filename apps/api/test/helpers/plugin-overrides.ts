import fp from "fastify-plugin";

/**
 * The only method src/routes uses on the namespace today. The route-facing
 * type comes from the `declare module "fastify"` augmentation in
 * src/types/fastify.d.ts, so a route calling a second method would still
 * typecheck against the real OAuth2Namespace while failing here at runtime
 * with an unnamed TypeError. The test that guards this lives next to this
 * file and greps src/routes for the methods it calls.
 */
export const oauthStubNamespace = {
  getAccessTokenFromAuthorizationCodeFlow: async () => ({
    token: { access_token: "google-access-token", token_type: "Bearer" },
  }),
};

/**
 * Stands in for @fastify/oauth2, which fetches Google's OIDC discovery
 * document over the network at registration time. fp() so the decoration
 * escapes encapsulation exactly as the real plugin's does.
 */
export const oauthStub = fp(async (fastify) => {
  // `as any` for the same reason test/helpers/app.ts:156 needs it: the
  // decoration is typed as the full OAuth2Namespace by a module augmentation,
  // and a stub will never carry its other members.
  fastify.decorate("googleOAuth2", oauthStubNamespace as any);
});

/**
 * Unit tests stub Mongoose models per test via stubMethod, so the server must
 * not open a connection. Integration tests omit this override and get the
 * real plugins/mongoose.
 */
export const noDb = fp(async () => {});
