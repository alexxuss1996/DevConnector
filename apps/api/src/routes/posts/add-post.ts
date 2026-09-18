import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { CreatePostSchema } from "@dev-conn/contracts";
import { postService } from "#modules/posts/posts.service";

const addPost: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    "/",
    {
      onRequest: [fastify.authenticate],
      schema: { body: CreatePostSchema },
    },
    async (request, reply) => {
      const { text } = request.body;
      const post = await postService.createPost(request.user.sub, text);
      return reply.status(200).send(post);
    },
  );
};

export default addPost;
