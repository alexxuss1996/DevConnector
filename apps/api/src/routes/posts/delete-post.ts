import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { postService } from "#modules/posts/posts.service";

import { Type } from "typebox";

const ParamsSchema = Type.Object({
  id: Type.String({
    minLength: 1,
    errorMessage: "ID must be at least 1 character",
  }),
});

const deletePost: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.delete(
    "/:id",
    {
      onRequest: [fastify.authenticate],
      schema: { params: ParamsSchema },
    },
    async function (request, reply) {
      const { id } = request.params;
      await postService.deletePost(request.user.sub, id);
      return reply.status(204).send({
        message: "The post was deleted",
      });
    },
  );
};

export default deletePost;
