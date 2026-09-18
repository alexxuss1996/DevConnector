import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { postService } from "#modules/posts/posts.service";
import { CreatePostCommentSchema, PostIdParamsSchema } from "@dev-conn/contracts";

const addPostComment: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.post(
    "/:id/comments",
    {
      onRequest: [fastify.authenticate],
      schema: { params: PostIdParamsSchema, body: CreatePostCommentSchema },
    },
    async function (request, reply) {
      const { id } = request.params;
      const { text } = request.body;
      const result = await postService.createPostComment(
        request.user.sub,
        id,
        text,
      );
      return reply.status(201).send(result);
    },
  );
};

export default addPostComment;
