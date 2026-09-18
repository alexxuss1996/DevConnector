import { profileService } from "#modules/profile/profile.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { ExperienceIdParamsSchema } from "@dev-conn/contracts";

const deleteExperience: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.delete(
    "/experience/:experienceId",
    {
      onRequest: [fastify.authenticate],
      schema: { params: ExperienceIdParamsSchema },
    },
    async function (request, reply) {
      const result = await profileService.deleteExperience(
        request.user.sub,
        request.params.experienceId,
      );
      return reply.status(200).send(result);
    },
  );
};

export default deleteExperience;
