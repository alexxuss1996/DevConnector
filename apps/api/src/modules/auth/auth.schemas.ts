import { Type } from "typebox";

const RegisterUserSchema = Type.Object({
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

const LoginUserSchema = Type.Object({
  email: Type.String({
    format: "email",
  }),
  password: Type.String({
    minLength: 8,
    maxLength: 255,
  }),
});

const CompleteOnboardingSchema = Type.Object({
  name: Type.String({
    minLength: 3,
    maxLength: 30,
  }),
});

export { RegisterUserSchema, LoginUserSchema, CompleteOnboardingSchema };
