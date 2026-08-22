export const trimEmail = async (request: { body?: unknown }) => {
  const body = request.body as { email?: unknown } | undefined;
  if (body && typeof body.email === "string") {
    body.email = body.email.trim();
  }
};
