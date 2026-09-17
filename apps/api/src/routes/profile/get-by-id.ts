import { Type } from "typebox";
import { profileService } from "#modules/profile/profile.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

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
    "/user/:id",
    {
      schema: { params: ParamsSchema },
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
