import { Static, Type } from "typebox";

export const RegisterUserSchema = Type.Object({
  name: Type.String({
    minLength: 3,
    maxLength: 30,
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
  }),
});

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
