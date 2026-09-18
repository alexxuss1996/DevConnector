import { CreateProfileSchema } from "@dev-conn/contracts";
import { profileService } from "#modules/profile/profile.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

const profile: FastifyPluginAsyncTypebox = async (fastify) => {
  (fastify.post(
    "/",
    {
      onRequest: [fastify.authenticate],
      schema: { body: CreateProfileSchema },
    },
    async (request, reply) => {
      const result = await profileService.createOrUpdateProfile(
        request.user.sub,
        request.body,
      );
      return reply.status(200).send(result);
    },
  ),
    fastify.get("/", async function (request, reply) {
      const profiles = await profileService.getProfiles();
      return {
        profiles,
      };
    }),
    fastify.delete(
      "/",
      {
        onRequest: [fastify.authenticate],
      },
      async function (request, reply) {
        await profileService.deleteProfileAndUser(request.user.sub);
        return reply.status(204).send({
          message: "The profile and user were deleted",
        });
      },
    ));
};

export default profile;
