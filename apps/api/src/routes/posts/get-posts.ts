import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { postService } from "#modules/posts/posts.service";

const PaginationQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});

const getPosts: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/",
    {
      onRequest: [fastify.authenticate],
      schema: { querystring: PaginationQuerySchema },
    },
    async function (request, _reply) {
      const { page, limit } = request.query;
      const posts = await postService.getPosts(page ?? 1, limit ?? 20);
      return {
        posts,
      };
    },
  );
};

export default getPosts;
