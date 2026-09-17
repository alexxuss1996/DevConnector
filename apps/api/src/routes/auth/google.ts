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

        if (err instanceof AppError && err.statusCode === 401) {
          return reply.status(401).send({
            message: "Google authentication failed",
          });
        }

        throw err;
      }
    },
  );
};

export default googleCallback;
