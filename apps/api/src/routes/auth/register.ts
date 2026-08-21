import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { RegisterUserSchema } from "#modules/auth/auth.schemas";
import { authService } from "#modules/auth/auth.service";
import { setAuthCookies } from "#helpers/auth.cookies";

const register: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.post(
    "/register",

    { schema: { body: RegisterUserSchema } },
    async function (request, reply) {
      const result = await authService.register(fastify, request.body);
      return setAuthCookies(reply, result.accessToken, result.refreshToken)
        .status(201)
        .send(result.user);
    },
  );
};

export default register;
