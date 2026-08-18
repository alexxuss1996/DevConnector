import { FastifyPluginAsync } from "fastify";

const posts: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get("/", async function (request, reply) {
    return "Posts";
  });
};

export default posts;
