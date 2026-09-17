import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { postService } from "#modules/posts/posts.service";

const deletePost: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.delete(
    "/",
    {
      onRequest: [fastify.authenticate],
    },
    async function (request, reply) {
      await postService.deletePost(request.user.sub);
      return reply.status(204).send({
        message: "The post was deleted",
      });
    },
  );
};

export default deletePost;
