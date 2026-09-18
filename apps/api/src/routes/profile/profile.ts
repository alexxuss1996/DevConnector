import { CreateProfileSchema, UpdateProfileSchema } from "@dev-conn/contracts";
import { profileService } from "#modules/profile/profile.service";
import { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "typebox";

// Querystring arrives as strings (?page=2); coerceTypes is disabled globally,
// so accept string-or-integer and normalize in the handler.
const PaginationQuerySchema = Type.Object({
  page: Type.Optional(
    Type.Union([Type.Integer({ minimum: 1 }), Type.String({ minLength: 1 })], {
      default: 1,
    }),
  ),
  limit: Type.Optional(
    Type.Union([Type.Integer({ minimum: 1, maximum: 100 }), Type.String({ minLength: 1 })], {
      default: 20,
    }),
  ),
});

export function parsePagination(query: { page?: unknown; limit?: unknown }): {
  page: number;
  limit: number;
} {
  const toInt = (v: unknown, fallback: number) => {
    const n = typeof v === "string" ? Number(v) : (v as number);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return fallback;
    return n;
  };
  return { page: toInt(query.page, 1), limit: toInt(query.limit, 20) };
}

const profile: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
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
      // Envelope convention: every profile endpoint returns { profile }.
      return reply.status(200).send({ profile: result });
    },
  );
  fastify.put(
    "/",
    {
      onRequest: [fastify.authenticate],
      schema: { body: UpdateProfileSchema },
    },
    async (request, reply) => {
      const result = await profileService.updateProfile(
        request.user.sub,
        request.body,
      );
      return reply.status(200).send({ profile: result });
    },
  );
  fastify.get(
    "/",
    {
      schema: {
        querystring: PaginationQuerySchema,
      },
    },
    async function (request, _reply) {
      const { page, limit } = parsePagination(request.query);
      const profiles = await profileService.getProfiles(page, limit);
      return {
        profiles,
      };
    },
  );
  fastify.delete(
    "/",
    {
      onRequest: [fastify.authenticate],
    },
    async function (request, reply) {
      await profileService.deleteProfileAndUser(request.user.sub);
      return reply.status(204).send();
    },
  );
};

export default profile;
