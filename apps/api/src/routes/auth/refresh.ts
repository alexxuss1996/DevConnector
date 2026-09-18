import { setAuthCookies } from "#helpers/auth.cookies";
import { authService } from "#modules/auth/auth.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

const refresh: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.post(
    "/refresh",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async function (request, reply) {
      const token = request.cookies.refresh_token;
      if (!token) {
        return reply
          .status(401)
          .send({ code: "FAILED_AUTHENTICATION", message: "Unauthorized" });
      }
      const result = await authService.refresh(fastify, token);
      return setAuthCookies(reply, result.accessToken, result.refreshToken).send(
        result.user,
      );
    },
  );
};

export default refresh;
