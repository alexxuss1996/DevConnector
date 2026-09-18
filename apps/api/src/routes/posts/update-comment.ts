import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { postService } from "#modules/posts/posts.service";
import { UpdatePostCommentSchema, PostCommentIdParamsSchema } from "@dev-conn/contracts";

const updatePostComment: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.put(
    "/:id/comments/:commentId",
    {
      onRequest: [fastify.authenticate],
      schema: { params: PostCommentIdParamsSchema, body: UpdatePostCommentSchema },
    },
    async function (request, reply) {
      const { id, commentId } = request.params;
      const { text } = request.body;
      const result = await postService.updatePostComment(
        request.user.sub,
        id,
        commentId,
        text,
      );
      return reply.status(200).send(result);
    },
  );
};

export default updatePostComment;
