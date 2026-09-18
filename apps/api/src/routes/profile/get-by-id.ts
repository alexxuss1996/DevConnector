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
      const { id } = request.params;
      const profile = await profileService.getProfile(id);
      return {
        profile,
      };
    },
  );
};

export default getProfileById;
