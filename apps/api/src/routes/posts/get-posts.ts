import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { postService } from "#modules/posts/posts.service";

const PaginationQuerySchema = Type.Object({
  page: Type.Optional(
    Type.Union([Type.Integer({ minimum: 1 }), Type.String({ minLength: 1 })], {
      default: 1,
    }),
  ),
  limit: Type.Optional(
    Type.Union([Type.Integer({ minimum: 1, maximum: 100 }), Type.String({ minLength: 1 })], {
      default: 20,
    }),
  ),
});

function parsePagination(query: { page?: unknown; limit?: unknown }): {
  page: number;
  limit: number;
} {
  const toInt = (v: unknown, fallback: number) => {
    const n = typeof v === "string" ? Number(v) : (v as number);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return fallback;
    return n;
  };
  return { page: toInt(query.page, 1), limit: toInt(query.limit, 20) };
}

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
