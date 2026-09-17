import AppError from "#helpers/app-error";
import { clearAuthCookies } from "#helpers/auth.cookies";
import { authService } from "#modules/auth/auth.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

const logout: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.post("/logout", async function (request, reply) {
    const token = request.cookies.refresh_token;
    try {
      if (token) {
        await authService.logout(fastify, token);
      }
    } catch (err) {
      if (
        !(err instanceof AppError) ||
        err.statusCode !== 401 ||
        err.code !== "INVALID_CREDENTIALS"
      ) {
        throw err;
      }
      fastify.log.warn({ err }, "logout: session could not be revoked");
    } finally {
      clearAuthCookies(reply);
    }

    return reply.status(204).send();
  });
};

export default logout;
