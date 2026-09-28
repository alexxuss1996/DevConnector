import { ErrorResponseSchema, ProfileResponseSchema } from "@dev-conn/contracts";
import { profileService } from "#modules/profiles/profiles.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

const me: FastifyPluginAsyncTypebox = async (fastify, opts) => {
  fastify.get(
    "/me",
    {
      onRequest: [fastify.authenticate],
      schema: {
        tags: ["Profiles"],
        summary: "Get your own profile",
        response: {
          200: ProfileResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async function (request, reply) {
      const profile = await profileService.getProfile(request.user.sub);
      return { profile };
    },
  );
};

export default me;
