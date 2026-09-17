import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { postService } from "#modules/posts/posts.service";

const getPosts: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticate],
    },
    async function (request, reply) {
      const posts = await postService.getPosts();
      return {
        posts,
      };
    },
  );
};

export default getPosts;
