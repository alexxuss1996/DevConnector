import { profileService } from "#modules/profiles/profiles.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import {
  ExperienceIdParamsSchema,
  ErrorResponseSchema,
  ProfileResponseSchema,
} from "@dev-conn/contracts";

const deleteExperience: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.delete(
    "/experience/:experienceId",
    {
      onRequest: [fastify.authenticate],
      schema: {
        tags: ["Profiles"],
        summary: "Remove a job from your experience",
        params: ExperienceIdParamsSchema,
        response: {
          200: ProfileResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
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
