import { clearAuthCookies } from "#helpers/auth.cookies";
import { authService } from "#modules/auth/auth.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

const logout: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.post("/logout", async function (request, reply) {
    const token = request.cookies.refresh_token;
    if (token) {
      await authService.logout(fastify, token);
    }

    return clearAuthCookies(reply).status(204).send();
  });
};

export default logout;
