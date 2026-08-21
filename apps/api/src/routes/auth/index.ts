import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

const auth: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.get("/", async function (request, reply) {
    return reply.status(200).send({ message: "Auth is working" });
  });
};

export default auth;
