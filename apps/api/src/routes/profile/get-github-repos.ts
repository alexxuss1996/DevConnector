import { profileService } from "#modules/profile/profile.service";
import {
  FastifyPluginAsyncTypebox,
  Type,
} from "@fastify/type-provider-typebox";

const ParamsSchema = Type.Object({
  username: Type.String({
    minLength: 1,
    errorMessage: "Username must be at least 1 character",
  }),
});

const getLastGithubRepos: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.get(
    "/github/:username",
    {
      onRequest: [fastify.authenticate],
      schema: { params: ParamsSchema },
    },
    async function (request, reply) {
      const profile = await profileService.getGithubReposForProfile(
        request.params.username,
      );
      return reply.status(200).send(profile);
    },
  );
};

export default getLastGithubRepos;
