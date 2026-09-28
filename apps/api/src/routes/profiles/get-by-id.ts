import { ErrorResponseSchema, ProfileIdParamsSchema, ProfileResponseSchema } from "@dev-conn/contracts";
import { PUBLIC_CACHE_CONTROL } from "#helpers/request-id";
import { profileService } from "#modules/profiles/profiles.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

const getProfileById: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.get(
    "/user/:id",
    {
      schema: {
        tags: ["Profiles"],
        summary: "Get a public profile by user id or profile id",
        params: ProfileIdParamsSchema,
        response: {
          200: ProfileResponseSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async function (request, reply) {
      // `:id` accepts either the user id or the profile `_id`; the service
      // matches both in a single query.
      const profile = await profileService.getProfile(request.params.id);
      reply.header("Cache-Control", PUBLIC_CACHE_CONTROL);
      return { profile };
    },
  );
};

export default getProfileById;
