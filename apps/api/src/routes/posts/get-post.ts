import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { postService } from "#modules/posts/posts.service";
import { PostIdParamsSchema } from "@dev-conn/contracts";

const getPost: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.get(
    "/:id",
    {
      schema: { params: PostIdParamsSchema },
    },
    async function (request, reply) {
      const { id } = request.params;
      const post = await postService.getPost(id);
      return {
        post,
      };
    },
  );
};

export default getPost;
