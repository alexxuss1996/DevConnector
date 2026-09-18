import { type FastifyPluginAsync } from "fastify";

const root: FastifyPluginAsync = async (fastify, _opts): Promise<void> => {
  fastify.get(
    "/",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: { root: { type: "boolean" } },
          },
        },
      },
    },
    async (_request, _reply) => {
      return { root: true };
    },
  );
};

export default root;
