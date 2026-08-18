import { type FastifyPluginAsync } from "fastify";

const profile: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get("/", async function (request, reply) {
    return "Profile";
  });
};

export default profile;
