import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { postService } from "#modules/posts/posts.service";
import { PostIdParamsSchema } from "@dev-conn/contracts";

const getPostComments: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.get(
    "/:id/comments",
    {
      onRequest: [fastify.authenticate],
      schema: { params: PostIdParamsSchema },
    },
    async function (request, reply) {
      const { id } = request.params;
      const comments = await postService.getPostComments(id);
      return {
        comments,
      };
    },
  );
};

export default getPostComments;
