import { FastifyReply } from "fastify";

const ACCESS_TOKEN_MAX_AGE = 60 * 15;
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30;

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

export function clearAuthCookies(reply: FastifyReply) {
  return reply
    .clearCookie("access_token", {
      path: "/",
    })
    .clearCookie("refresh_token", {
      path: "/auth",
    });
}
