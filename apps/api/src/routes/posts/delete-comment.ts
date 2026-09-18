import { postService } from "#modules/posts/posts.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { PostCommentIdParamsSchema } from "@dev-conn/contracts";
const deletePostComment: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.delete(
    "/:id/comments/:commentId",
    {
      onRequest: [fastify.authenticate],
      schema: { params: PostCommentIdParamsSchema },
    },
    async function (request, reply) {
      const { id, commentId } = request.params;
      await postService.deletePostComment(request.user.sub, id, commentId);
      return reply.status(204).send();
    },
  );
};

export default deletePostComment;
