import { CreateProfileSchema } from "@dev-conn/contracts";
import { profileService } from "#modules/profile/profile.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";

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
    fastify.get(
      "/",
      {
        schema: {
          querystring: Type.Object({
            page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
            limit: Type.Optional(
              Type.Integer({ minimum: 1, maximum: 100, default: 20 }),
            ),
          }),
        },
      },
      async function (request, _reply) {
        const { page, limit } = request.query;
        const profiles = await profileService.getProfiles(page ?? 1, limit ?? 20);
        return {
          profiles,
        };
      },
    ),
    fastify.delete(
      "/",
      {
        onRequest: [fastify.authenticate],
      },
      async function (request, reply) {
        await profileService.deleteProfileAndUser(request.user.sub);
        return reply.status(204).send();
      },
    ));
};

export default profile;
