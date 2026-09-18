import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { postService } from "#modules/posts/posts.service";
import { PostIdParamsSchema } from "@dev-conn/contracts";

const likePost: FastifyPluginAsyncTypebox = async (fastify) => {

  fastify.put(
    "/:id/like",
    {
      onRequest: [fastify.authenticate],
      schema: { params: PostIdParamsSchema },
    },
    async function (request, reply) {
      const { id } = request.params;
      await postService.likePost(request.user.sub, id);
      return reply.status(204).send();
    },
  );
  fastify.put(
    "/:id/unlike",
    {
      onRequest: [fastify.authenticate],
      schema: { params: PostIdParamsSchema },
    },
    async function (request, reply) {
      const { id } = request.params;
      await postService.unlikePost(request.user.sub, id);
      return reply.status(204).send();
    },
  );
};

export default likePost;
