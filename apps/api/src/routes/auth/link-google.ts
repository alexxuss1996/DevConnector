import { LinkGoogleSchema } from "@dev-conn/contracts";
import { authService } from "#modules/auth/auth.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

const linkGoogle: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    "/google/link",
    {
      onRequest: [fastify.authenticate],
      schema: { body: LinkGoogleSchema },
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const result = await authService.linkGoogleAccount(
        request.user.sub,
        request.body.accessToken,
      );
      return reply.status(200).send(result);
    },
  );

  fastify.delete(
    "/google/link",
    {
      onRequest: [fastify.authenticate],
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      await authService.unlinkGoogleAccount(request.user.sub);
      return reply.status(204).send();
    },
  );
};

export default linkGoogle;
