import { profileService } from "#modules/profile/profile.service";
import {
  FastifyPluginAsyncTypebox,
  Type,
} from "@fastify/type-provider-typebox";

const ParamsSchema = Type.Object({
  educationId: Type.String({
    pattern: "^[0-9a-fA-F]{24}$",
    errorMessage: "Invalid ObjectId",
  }),
});

const deleteEducation: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.delete(
    "/education/:educationId",
    {
      onRequest: [fastify.authenticate],
      schema: { params: ParamsSchema },
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
