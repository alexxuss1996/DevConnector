import {
  CreateProfileSchema,
  ErrorResponseSchema,
  PaginationQuerySchema,
  ProfileListResponseSchema,
  ProfileResponseSchema,
  UpdateProfileSchema,
  parsePagination,
} from "@dev-conn/contracts";
import { PUBLIC_CACHE_CONTROL } from "#helpers/request-id";
import { profileService } from "#modules/profiles/profiles.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";

const profile: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    "/",
    {
      onRequest: [fastify.authenticate],
      schema: {
        tags: ["Profiles"],
        summary: "Create a profile",
        body: CreateProfileSchema,
        response: {
          201: ProfileResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const profile = await profileService.createProfile(
        request.user.sub,
        request.body,
      );
      return reply.status(201).send({ profile });
    },
  );

  fastify.patch(
    "/",
    {
      onRequest: [fastify.authenticate],
      schema: {
        tags: ["Profiles"],
        summary: "Partially update your profile",
        body: UpdateProfileSchema,
        response: {
          200: ProfileResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const profile = await profileService.updateProfile(
        request.user.sub,
        request.body,
      );
      return reply.status(200).send({ profile });
    },
  );

  fastify.get(
    "/",
    {
      schema: {
        tags: ["Profiles"],
        summary: "List public profiles",
        querystring: PaginationQuerySchema,
        response: { 200: ProfileListResponseSchema },
      },
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async function (request, reply) {
      const { page, limit } = parsePagination(request.query);
      const { profiles, total } = await profileService.getProfiles(page, limit);
      reply.header("Cache-Control", PUBLIC_CACHE_CONTROL);
      return { profiles, total, page, limit };
    },
  );

  fastify.delete(
    "/",
    {
      onRequest: [fastify.authenticate],
      schema: {
        tags: ["Profiles"],
        summary: "Delete your profile and account",
      },
    },
    async function (request, reply) {
      await profileService.deleteProfileAndUser(request.user.sub);
      return reply.status(204).send();
    },
  );
};

export default profile;
