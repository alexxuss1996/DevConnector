import { Type } from "typebox";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { postService } from "#modules/posts/posts.service";
import { CreatePostCommentSchema } from "#modules/posts/posts.schemas";

const ParamsSchema = Type.Object({
  id: Type.String({
    minLength: 1,
    errorMessage: "ID must be at least 1 character",
  }),
});

const addPostComment: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.post(
    "/:id/comments",
    {
      onRequest: [fastify.authenticate],
      schema: { params: ParamsSchema, body: CreatePostCommentSchema },
    },
    async function (request, reply) {
      const { id } = request.params;
      const { text } = request.body;
      const result = await postService.createPostComment(
        request.user.sub,
        id,
        text,
      );
      return reply.status(200).send(result);
    },
  );
};

export default addPostComment;
