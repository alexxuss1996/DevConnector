/**
 * Trims surrounding whitespace from an email in the request body.
 *
 * @param request - Request-like object whose body may contain an email.
 */
export const trimEmail = async (request: { body?: unknown }) => {
  const body = request.body as { email?: unknown } | undefined;
  if (body && typeof body.email === "string") {
    body.email = body.email.trim().toLowerCase();
  }
};
