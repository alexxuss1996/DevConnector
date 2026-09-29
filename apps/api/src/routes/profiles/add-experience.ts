import {
  AddExperienceSchema,
  ErrorResponseSchema,
  ProfileResponseSchema,
} from "@dev-conn/contracts";
import { profileService } from "#modules/profiles/profiles.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

const addExperience: FastifyPluginAsyncTypebox = async (
  fastify,
  _opts,
): Promise<void> => {
  fastify.post(
    "/experience",
    {
      onRequest: [fastify.authenticate],
      schema: {
        tags: ["Profiles"],
        summary: "Add a job to your experience",
        body: AddExperienceSchema,
        response: {
          201: ProfileResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async function (request, reply) {
      const result = await profileService.addExperience(
        request.user.sub,
        request.body,
      );
      return reply.status(201).send(result);
    },
  );
};

export default addExperience;
