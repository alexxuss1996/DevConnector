import { Static, Type } from "typebox";

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

export const CompleteOnboardingSchema = Type.Object({
  name: Type.String({
    minLength: 3,
    maxLength: 30,
    pattern: NON_BLANK_PATTERN,
    errorMessage: "Name must be 3-30 characters and cannot be blank",
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
export type CompleteOnboardingInput = Static<typeof CompleteOnboardingSchema>;

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
