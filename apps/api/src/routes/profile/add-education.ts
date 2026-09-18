import { AddEducationSchema } from "@dev-conn/contracts";
import { profileService } from "#modules/profile/profile.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

const addEducation: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.post(
    "/education",
    {
      onRequest: [fastify.authenticate],
      schema: { body: AddEducationSchema },
    },
    async function (request, reply) {
      const result = await profileService.addEducation(
        request.user.sub,
        request.body,
      );
      return reply.status(200).send(result);
    },
  );
};

export default addEducation;
