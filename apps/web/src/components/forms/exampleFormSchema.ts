import { type Static, Type } from "typebox";

export const exampleFormSchema = Type.Object({
  name: Type.String({
    minLength: 2,
    errorMessage: "Name needs at least 2 characters.",
  }),
  email: Type.String({
    pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
    errorMessage: "Enter a valid email address.",
  }),
  password: Type.String({
    minLength: 8,
    errorMessage: "Password needs at least 8 characters.",
  }),
  age: Type.Integer({
    minimum: 13,
    errorMessage: "Must be 13 or older.",
  }),
  bio: Type.Optional(
    Type.String({
      maxLength: 280,
      errorMessage: "Bio must be 280 characters or less.",
    }),
  ),
  role: Type.Union(
    [Type.Literal("frontend"), Type.Literal("backend"), Type.Literal("fullstack")],
    { errorMessage: "Pick a role." },
  ),
  gender: Type.Union(
    [Type.Literal("she"), Type.Literal("he"), Type.Literal("they")],
    { errorMessage: "Pick an option." },
  ),
  birthdate: Type.String({
    minLength: 1,
    errorMessage: "Pick a birthdate.",
  }),
  notify: Type.Boolean(),
  terms: Type.Literal(true, {
    errorMessage: "You must accept the terms.",
  }),
  tags: Type.Array(Type.String(), {
    minItems: 1,
    errorMessage: "Add at least one tag.",
  }),
});

export type ExampleFormValues = Static<typeof exampleFormSchema>;
