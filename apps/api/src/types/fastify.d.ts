import "fastify";
import type { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import type { OAuth2Namespace } from "@fastify/oauth2";
import type mongoose from "mongoose";

declare module "fastify" {
  interface FastifyInstance {
    googleOAuth2: OAuth2Namespace;
    db: typeof mongoose.connection;
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}

export type { FastifyRequest, FastifyReply, FastifyInstance };
