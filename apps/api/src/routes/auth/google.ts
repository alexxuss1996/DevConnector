import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { authService } from "#modules/auth/auth.service";

const googleCallback: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get("/google/callback", async (request, reply) => {
    try {
      const { token } =
        await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(
          request,
        );

      const result = await authService.authenticateGoogle(
        fastify,
        token.access_token,
      );

      reply
        .setCookie("access_token", result.accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        })
        .setCookie("refresh_token", result.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/auth",
        });

      return reply.redirect("http://localhost:3000");
    } catch (err) {
      fastify.log.error(err);

      return reply.status(401).send({
        message: "Google authentication failed",
      });
    }
  });
};

export default googleCallback;
