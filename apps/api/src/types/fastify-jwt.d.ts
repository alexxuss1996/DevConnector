import "@fastify/jwt";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      type: "access" | "refresh";
      sessionId?: string;
      jti?: string;
    };

    user: {
      sub: string;
      type: "access" | "refresh";
      sessionId?: string;
    };
  }
}
