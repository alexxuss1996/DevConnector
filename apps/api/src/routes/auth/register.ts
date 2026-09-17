import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { RegisterUserSchema } from "#modules/auth/auth.schemas";
import { authService } from "#modules/auth/auth.service";
import { setAuthCookies } from "#helpers/auth.cookies";
import { trimEmail } from "#helpers/auth";

const register: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.post(
    "/register",

    {
      preValidation: [trimEmail],
      schema: { body: RegisterUserSchema },
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async function (request, reply) {
      const result = await authService.register(fastify, request.body);
      return setAuthCookies(reply, result.accessToken, result.refreshToken)
        .status(201)
        .send(result.user);
    },
  );
};

export default register;
