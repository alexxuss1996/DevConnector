import { postService } from "#modules/posts/posts.service";
import {
  FastifyPluginAsyncTypebox,
  Type,
} from "@fastify/type-provider-typebox";

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
const deletePostComment: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.delete(
    "/:id/comments/:commentId",
    {
      onRequest: [fastify.authenticate],
      schema: { params: ParamsSchema },
    },
    async function (request, reply) {
      const { id, commentId } = request.params;
      await postService.deletePostComment(request.user.sub, id, commentId);
      return reply.status(204).send({
        message: "The comment was deleted",
      });
    },
  );
};

export default deletePostComment;
