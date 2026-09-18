import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { postService } from "#modules/posts/posts.service";
import { PostIdParamsSchema } from "@dev-conn/contracts";

const deletePost: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.delete(
    "/:id",
    {
      onRequest: [fastify.authenticate],
      schema: { params: PostIdParamsSchema },
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
