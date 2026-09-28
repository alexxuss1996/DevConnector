import { PaginationQuerySchema, parsePagination } from "@dev-conn/contracts";
import { postService } from "#modules/posts/posts.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

const getPosts: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticate],
      schema: { querystring: PaginationQuerySchema },
    },
    async function (request, _reply) {
      const { page, limit } = parsePagination(request.query);
      const posts = await postService.getPosts(page, limit);
      return {
        posts,
      };
    },
  );
};

export default getPosts;
