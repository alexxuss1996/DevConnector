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

// Re-exported response user shape (derived from backend; kept lightweight for frontend use)
export type AuthUser = {
  id: string;
  name?: string;
  email: string;
  avatar?: string;
};
