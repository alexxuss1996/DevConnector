import { AddExperienceSchema } from "@dev-conn/contracts";
import { profileService } from "#modules/profile/profile.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

const addExperience: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.post(
    "/experience",
    {
      onRequest: [fastify.authenticate],
      schema: { body: AddExperienceSchema },
    },
    async function (request, reply) {
      const result = await profileService.addExperience(
        request.user.sub,
        request.body,
      );
      return reply.status(200).send(result);
    },
  );
};

export default addExperience;
