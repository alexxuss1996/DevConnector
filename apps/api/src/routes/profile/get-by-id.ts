import { profileService } from "#modules/profile/profile.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { ProfileIdParamsSchema } from "@dev-conn/contracts";

const getProfileById: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.get(
    "/user/:id",
    {
      schema: { params: ProfileIdParamsSchema },
    },
    async function (request, reply) {
      // `:id` accepts either the user id or the profile `_id`
      // (see profileService.getProfile fallback).
      const { id: userId } = request.params;
      const profile = await profileService.getProfile(userId);
      return {
        profile,
      };
    },
  );
};

export default getProfileById;
