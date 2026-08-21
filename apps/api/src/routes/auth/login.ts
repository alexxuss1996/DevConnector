import { LoginUserSchema } from "#modules/auth/auth.schemas";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { authService } from "#modules/auth/auth.service";
import { setAuthCookies } from "#helpers/auth.cookies";

const login: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.post(
    "/login",

    { schema: { body: LoginUserSchema } },
    async function (request, reply) {
      const result = await authService.login(fastify, request.body);
      return setAuthCookies(
        reply,
        result.accessToken,
        result.refreshToken,
      ).send(result.user);
    },
  );
};

export default login;
