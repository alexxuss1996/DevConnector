import { Type } from "typebox";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { postService } from "#modules/posts/posts.service";

const ParamsSchema = Type.Object({
  id: Type.String({
    minLength: 1,
    errorMessage: "ID must be at least 1 character",
  }),
});

const getProfileById: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.get(
    "/:id",
    {
      schema: { params: ParamsSchema },
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

export default getProfileById;
