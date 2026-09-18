import { profileService } from "#modules/profile/profile.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { GithubUsernameParamsSchema } from "@dev-conn/contracts";

const getLastGithubRepos: FastifyPluginAsyncTypebox = async (
  fastify,
  opts,
): Promise<void> => {
  fastify.get(
    "/github/:username",
    {
      onRequest: [fastify.authenticate],
      schema: { params: GithubUsernameParamsSchema },
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
