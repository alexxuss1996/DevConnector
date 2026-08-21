import { type FastifyPluginAsync } from "fastify";

const profile: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get(
    "/",
    { onRequest: [fastify.authenticate] },
    async function (request, reply) {
      return {
        id: request.user.sub,
      };
    },
  );
};

export default profile;
