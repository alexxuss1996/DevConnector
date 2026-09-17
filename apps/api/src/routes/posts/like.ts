import {
  FastifyPluginAsyncTypebox,
  Type,
} from "@fastify/type-provider-typebox";
import { postService } from "#modules/posts/posts.service";

const likePost: FastifyPluginAsyncTypebox = async (fastify) => {
  const ParamsSchema = Type.Object({
    id: Type.String({
      minLength: 1,
      errorMessage: "ID must be at least 1 character",
    }),
  });

  (fastify.put(
    "/:id/like",
    {
      onRequest: [fastify.authenticate],
      schema: { params: ParamsSchema },
    },
    async function (request, reply) {
      const { id } = request.params;
      await postService.likePost(request.user.sub, id);
      return reply.status(204).send({
        message: "The post was liked",
      });
    },
  ),
    fastify.put(
      "/:id/unlike",
      {
        onRequest: [fastify.authenticate],
        schema: { params: ParamsSchema },
      },
      async function (request, reply) {
        const { id } = request.params;
        await postService.unlikePost(request.user.sub, id);
        return reply.status(204).send({
          message: "The post was unliked",
        });
      },
    ));
};

export default likePost;
