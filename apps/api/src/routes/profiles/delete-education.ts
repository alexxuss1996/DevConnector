import { profileService } from "#modules/profiles/profiles.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import {
  EducationIdParamsSchema,
  ErrorResponseSchema,
  ProfileResponseSchema,
} from "@dev-conn/contracts";

const deleteEducation: FastifyPluginAsyncTypebox = async (
  fastify,
  _opts,
): Promise<void> => {
  fastify.delete(
    "/education/:educationId",
    {
      onRequest: [fastify.authenticate],
      schema: {
        tags: ["Profiles"],
        summary: "Remove a school from your education",
        params: EducationIdParamsSchema,
        response: {
          200: ProfileResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
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
