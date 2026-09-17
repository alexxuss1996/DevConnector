import { Type } from "typebox";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { postService } from "#modules/posts/posts.service";
import { UpdatePostCommentSchema } from "#modules/posts/posts.schemas";

const ParamsSchema = Type.Object({
  id: Type.String({
    minLength: 1,
    errorMessage: "ID must be at least 1 character",
  }),
  commentId: Type.String({
    minLength: 1,
    errorMessage: "Comment ID must be at least 1 character",
  }),
});

const updatePostComment: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.put(
    "/:id/comments/:commentId",
    {
      onRequest: [fastify.authenticate],
      schema: { params: ParamsSchema, body: UpdatePostCommentSchema },
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
