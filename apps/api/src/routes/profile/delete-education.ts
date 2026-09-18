import { profileService } from "#modules/profile/profile.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { EducationIdParamsSchema } from "@dev-conn/contracts";

const deleteEducation: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.delete(
    "/education/:educationId",
    {
      onRequest: [fastify.authenticate],
      schema: { params: EducationIdParamsSchema },
    },
    async function (request, reply) {
      const result = await profileService.deleteEducation(
        request.user.sub,
        request.params.educationId,
      );
      return reply.status(200).send(result);
    },
  );
};

export default deleteEducation;
