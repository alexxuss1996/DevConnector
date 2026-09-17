import { Type } from "typebox";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { postService } from "#modules/posts/posts.service";

const ParamsSchema = Type.Object({
  id: Type.String({
    minLength: 1,
    errorMessage: "ID must be at least 1 character",
  }),
});

const getPostComments: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.get(
    "/:id/comments",
    {
      schema: { params: ParamsSchema },
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
