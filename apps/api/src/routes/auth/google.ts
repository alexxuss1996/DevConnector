import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { authService } from "#modules/auth/auth.service";
import AppError from "#helpers/app-error";
import { setAuthCookies } from "#helpers/auth.cookies";
import env from "#config/env";

const googleCallback: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/google/callback",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      try {
        const { token } =
          await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(
            request,
          );

        const result = await authService.authenticateGoogle(
          fastify,
          token.access_token,
        );

        return setAuthCookies(
          reply,
          result.accessToken,
          result.refreshToken,
        ).redirect(env.FRONTEND_URL!);
      } catch (err) {
        fastify.log.error(err);

        // Browser OAuth flow: signal failure via redirect so the frontend
        // can display it instead of a raw API error page. 409 (email taken)
        // is the expected path for existing password users — they log in
        // normally and link Google from account settings.
        if (err instanceof AppError) {
          if (err.statusCode === 409) {
            return reply.redirect(
              `${env.FRONTEND_URL}?error=google_account_conflict`,
            );
          }
          if (err.statusCode === 401) {
            return reply.redirect(
              `${env.FRONTEND_URL}?error=google_auth_failed`,
            );
          }
        }

        return reply.redirect(`${env.FRONTEND_URL}?error=google_failed`);
      }
    },
  );
};

export default googleCallback;
