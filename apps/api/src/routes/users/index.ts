import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

const users: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.get("/", async function (request, reply) {
    return "Users";
  });
};

export default users;
