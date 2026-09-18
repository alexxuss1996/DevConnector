import "@fastify/jwt";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      type: "access" | "refresh";
      // Optional in types for legacy tokens; the `authenticate` guard
      // rejects access tokens without a sessionId at runtime.
      sessionId?: string;
      jti?: string;
    };

    user: {
      sub: string;
      type: "access" | "refresh";
      sessionId?: string;
      jti?: string;
    };
  }
}
