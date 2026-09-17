import { profileService } from "#modules/profile/profile.service";
import {
  FastifyPluginAsyncTypebox,
  Type,
} from "@fastify/type-provider-typebox";

const ParamsSchema = Type.Object({
  experienceId: Type.String({
    pattern: "^[0-9a-fA-F]{24}$",
    errorMessage: "Invalid ObjectId",
  }),
});

const deleteExperience: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.delete(
    "/experience/:experienceId",
    {
      onRequest: [fastify.authenticate],
      schema: { params: ParamsSchema },
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
