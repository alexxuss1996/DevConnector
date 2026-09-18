import { clearAuthCookies } from "#helpers/auth.cookies";
import { authService } from "#modules/auth/auth.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

const logoutAll: FastifyPluginAsyncTypebox = async (
  fastify,
  _opts,
): Promise<void> => {
  fastify.post(
    "/logout-all",
    {
      onRequest: [fastify.authenticate],
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async function (request, reply) {
      await authService.logoutAll(request.user.sub);
      clearAuthCookies(reply);
      return reply.status(204).send();
    },
  );
};

export default logoutAll;
