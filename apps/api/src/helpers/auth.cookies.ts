import { FastifyReply } from "fastify";
import { isProduction } from "#config/env";

const ACCESS_TOKEN_MAX_AGE = 60 * 15;
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Which `SameSite` the auth cookies need, which is decided by deployment
 * topology rather than by any request.
 *
 * The frontend and the API are different *sites* the moment they sit on
 * different domains — a Vercel-hosted frontend against an API on Northflank is
 * cross-site, and the browser will not attach a `Lax` cookie to the `fetch`
 * that carries it. Every authenticated call then returns 401 while login itself
 * appears to succeed, because the `Set-Cookie` was accepted and then ignored.
 *
 * So production is `None` and everything else is `Lax`: locally both run on
 * localhost, where a differing port is still the same site and `Lax` is
 * stricter for free. `None` also works if production ever co-locates the two on
 * one domain — it is strictly more permissive than `Lax` and the browser sends
 * it either way.
 *
 * Both flags come from one `isProduction()` call because browsers *reject*
 * `SameSite=None` without `Secure`. Deriving them separately could emit that
 * invalid pair, and the browser's response is to drop the cookie silently.
 *
 * What this costs: under `Lax` a cross-site POST never carries the cookie, so
 * the CSRF check in plugins/csrf.ts was defence-in-depth. Under `None` it
 * carries it, and that Origin check is the only thing rejecting a forged
 * mutation. It is load-bearing now — do not relax it to accommodate a client.
 */
const sameSite = (): "lax" | "none" => (isProduction() ? "none" : "lax");

/**
 * Adds the access and refresh token cookies to an authentication response.
 *
 * @param reply - Fastify reply used to set the cookies.
 * @param accessToken - Signed access token for API authorization.
 * @param refreshToken - Signed token used to refresh the session.
 * @returns The reply with both authentication cookies attached.
 */
export function setAuthCookies(
  reply: FastifyReply,
  accessToken: string,
  refreshToken: string,
) {
  return reply
    .setCookie("access_token", accessToken, {
      httpOnly: true,
      secure: isProduction(),
      sameSite: sameSite(),
      path: "/",
      maxAge: ACCESS_TOKEN_MAX_AGE,
    })
    .setCookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: isProduction(),
      sameSite: sameSite(),
      path: "/auth",
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });
}

/**
 * Removes both authentication cookies from a response.
 *
 * @param reply - Fastify reply used to clear the cookies.
 * @returns The reply with both authentication cookies cleared.
 */
export function clearAuthCookies(reply: FastifyReply) {
  const secure = isProduction();
  const site = sameSite();
  return reply
    .clearCookie("access_token", {
      path: "/",
      httpOnly: true,
      secure,
      sameSite: site,
    })
    .clearCookie("refresh_token", {
      path: "/auth",
      httpOnly: true,
      secure,
      sameSite: site,
    });
}
