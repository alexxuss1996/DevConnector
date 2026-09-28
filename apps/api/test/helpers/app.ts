import type { FastifyInstance } from "fastify";
import Session from "#modules/auth/session.model";
import { Types } from "mongoose";
import {
  lookupSessionUser,
  mkQuery,
  newId,
  recordSessionToken,
  stubMethod,
} from "./stubs.ts";

interface AuthPayload {
  sub: string;
  type: "access" | "refresh";
  sessionId?: string;
}

/**
 * Signs an access token that always carries a sessionId (production auth
 * requires one) and auto-stubs `Session.findById` so the token passes the
 * revocation check without a real database.
 *
 * Tests that need custom session states (revoked, expired, missing) stub
 * `Session.findById` explicitly — the explicit stub replaces this default.
 */
export function signAccessToken(
  app: FastifyInstance,
  payload: Partial<AuthPayload> & Record<string, unknown> = {},
): string {
  const sub = (payload.sub ?? newId().toString()).toString();
  const sessionId = (payload.sessionId ?? newId().toString()).toString();
  recordSessionToken(sessionId, sub);
  ensureSessionStub();
  const { sub: _s, sessionId: _sid, ...rest } = payload;
  return app.jwt.sign(
    { type: "access", ...rest, sub, sessionId } as AuthPayload,
    { expiresIn: "15m" },
  );
}

function ensureSessionStub(): void {
  if ((Session.findById as any).mock) return;
  stubMethod(Session, "findById", ((id: unknown) => {
    const sid = (id as any)?.toString?.() ?? String(id);
    const sub = lookupSessionUser(sid);
    if (!sub) return mkQuery(null);
    return mkQuery({
      _id: new Types.ObjectId(sid),
      userId: new Types.ObjectId(sub),
      refreshTokenHash: "stub-hash",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      revokedAt: undefined,
    } as any);
  }) as any);
}

export function signRefreshToken(
  app: FastifyInstance,
  payload: Partial<AuthPayload> & Record<string, unknown>,
): string {
  return app.jwt.sign({ type: "refresh", ...payload } as AuthPayload, {
    expiresIn: "30d",
  });
}
