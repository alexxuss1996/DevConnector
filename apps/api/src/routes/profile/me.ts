import { profileService } from "#modules/profile/profile.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

const me: FastifyPluginAsyncTypebox = async (fastify, opts) => {
  fastify.get(
    "/me",
    { onRequest: [fastify.authenticate] },
    async function (request, reply) {
      const profile = await profileService.getProfile(request.user.sub);
      return {
        profile,
      };
    },
  );
};

export default me;
