import {
  AddEducationSchema,
  ErrorResponseSchema,
  ProfileResponseSchema,
} from "@dev-conn/contracts";
import { profileService } from "#modules/profiles/profiles.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

const addEducation: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.post(
    "/education",
    {
      onRequest: [fastify.authenticate],
      schema: {
        tags: ["Profiles"],
        summary: "Add a school to your education",
        body: AddEducationSchema,
        response: {
          201: ProfileResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async function (request, reply) {
      const result = await profileService.addEducation(
        request.user.sub,
        request.body,
      );
      return reply.status(201).send(result);
    },
  );
};

export default addEducation;
