import { profileService } from "#modules/profiles/profiles.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import {
  ErrorResponseSchema,
  GithubUsernameParamsSchema,
} from "@dev-conn/contracts";

const getLastGithubRepos: FastifyPluginAsyncTypebox = async (
  fastify,
  _opts,
): Promise<void> => {
  fastify.get(
    "/github/:username",
    {
      onRequest: [fastify.authenticate],
      schema: {
        tags: ["Profiles"],
        summary: "List a profile's public GitHub repositories",
        params: GithubUsernameParamsSchema,
        response: {
          // Raw upstream GitHub payload, not a profile shape.
          200: Type.Unknown(),
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
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
