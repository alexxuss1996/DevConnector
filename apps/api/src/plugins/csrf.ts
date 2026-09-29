import fp from "fastify-plugin";
import AppError from "#helpers/app-error";
import env from "#config/env";

/**
 * Lax CSRF guard for cookie-authenticated mutations.
 *
 * Token-less cookie auth (`access_token`) is vulnerable to cross-site form /
 * navigation POSTs. When a state-changing request carries auth cookies, we
 * require the `Origin`/`Referer` (when present — browsers always send one on
 * cross-site POSTs) to match `FRONTEND_URL`'s origin. Requests without any
 * Origin/Referer (same-origin navigations, curl, tests, mobile apps) pass
 * through; Bearer-header requests are unaffected since they need no cookie.
 *
 * `FRONTEND_URL` is resolved once at registration from the validated env
 * helper, so a malformed/missing value fails closed at boot instead of
 * silently allowing every cookie-authenticated mutation.
 *
 * The rejection is thrown, not sent, so it goes through `setErrorHandler` and
 * picks up the requestId that correlates the client's 403 with the log line.
 */
export default fp(async (fastify) => {
  const allowedOrigin = new URL(env.FRONTEND_URL).origin;

  fastify.addHook("onRequest", async (request) => {
    if (
      request.method === "GET" ||
      request.method === "HEAD" ||
      request.method === "OPTIONS"
    ) {
      return;
    }
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const hasAuthCookie =
      !!cookies && (!!cookies.access_token || !!cookies.refresh_token);
    if (!hasAuthCookie) return;

    const origin =
      (request.headers.origin as string | undefined) ??
      (request.headers.referer as string | undefined);
    if (!origin) return;

    let requestOrigin: string;
    try {
      requestOrigin = new URL(origin).origin;
    } catch {
      throw new AppError(403, "FORBIDDEN", "Invalid origin");
    }
    if (requestOrigin !== allowedOrigin) {
      throw new AppError(403, "FORBIDDEN", "Invalid origin");
    }
  });
});
