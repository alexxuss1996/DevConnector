import { Static, Type } from "@sinclair/typebox";

const NON_BLANK_PATTERN = ".*\\S.*";

export const RegisterUserSchema = Type.Object({
  name: Type.String({
    minLength: 3,
    maxLength: 30,
    pattern: NON_BLANK_PATTERN,
    errorMessage: "Name must be 3-30 characters and cannot be blank",
  }),
  email: Type.String({
    format: "email",
  }),
  password: Type.String({
    minLength: 8,
    maxLength: 255,
  }),
});

export const LoginUserSchema = Type.Object({
  email: Type.String({
    format: "email",
  }),
  password: Type.String({
    minLength: 8,
    maxLength: 255,
  }),
});

export const LinkGoogleSchema = Type.Object(
  {
    accessToken: Type.String({
      minLength: 1,
      description: "Google OAuth2 access token to link",
    }),
  },
  { additionalProperties: false },
);

export type LinkGoogleInput = Static<typeof LinkGoogleSchema>;

export type RegisterUserInput = Static<typeof RegisterUserSchema>;
export type LoginUserInput = Static<typeof LoginUserSchema>;

export const AuthUserSchema = Type.Object(
  {
    id: Type.String({ description: "User id (hex ObjectId string)" }),
    name: Type.Optional(Type.String()),
    email: Type.String({ format: "email" }),
    avatar: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export type AuthUser = Static<typeof AuthUserSchema>;

/**
 * What `POST /auth/login`, `/auth/register` and `/auth/refresh` actually return:
 * the user plus a freshly issued token pair. `AuthUserSchema` on its own
 * describes only the user, so a client typed as `Promise<AuthUser>` was
 * promising a shape the API never sent. Caught by
 * apps/api/test/contract.test.ts.
 */
export const AuthResponseSchema = Type.Object(
  {
    user: AuthUserSchema,
    accessToken: Type.String(),
    refreshToken: Type.String(),
  },
  { additionalProperties: false },
);

export type AuthResponse = Static<typeof AuthResponseSchema>;
