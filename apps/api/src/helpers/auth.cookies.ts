import { FastifyReply } from "fastify";

const ACCESS_TOKEN_MAX_AGE = 60 * 15;
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30;

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
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ACCESS_TOKEN_MAX_AGE,
    })
    .setCookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
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
  return reply
    .clearCookie("access_token", {
      path: "/",
    })
    .clearCookie("refresh_token", {
      path: "/auth",
    });
}
