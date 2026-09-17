import { Static, Type } from "typebox";

export const CreateProfileSchema = Type.Object({
  company: Type.Optional(
    Type.Union([
      Type.String({
        minLength: 1,
        errorMessage: "Company must be at least 1 character",
      }),
      Type.Literal(""),
      Type.Null(),
    ]),
  ),
  website: Type.Optional(
    Type.Union([
      Type.String({
        format: "uri",
        errorMessage: "Website must be a valid URL",
      }),
      Type.Literal(""),
      Type.Null(),
    ]),
  ),
  location: Type.Optional(
    Type.Union([
      Type.String({
        minLength: 1,
        errorMessage: "Location must be at least 1 character",
      }),
      Type.Literal(""),
      Type.Null(),
    ]),
  ),
  status: Type.String({
    minLength: 1,
    pattern: ".*\\S.*",
    errorMessage: "Status is required and cannot be empty",
  }),
  skills: Type.Array(
    Type.String({
      minLength: 1,
      pattern: ".*\\S.*",
      errorMessage: "Skill cannot be empty",
    }),
    {
      minItems: 1,
      errorMessage: "At least one skill is required",
    },
  ),
  bio: Type.Optional(
    Type.Union([
      Type.String({
        minLength: 1,
        maxLength: 500,
        errorMessage: "Bio must be 1-500 characters",
      }),
      Type.Literal(""),
      Type.Null(),
    ]),
  ),
  githubusername: Type.Optional(
    Type.Union([
      Type.String({
        minLength: 1,
        errorMessage: "GitHub username must be at least 1 character",
      }),
      Type.Literal(""),
      Type.Null(),
    ]),
  ),
  youtube: Type.Optional(
    Type.Union([
      Type.String({
        format: "uri",
        errorMessage: "YouTube must be a valid URL",
      }),
      Type.Literal(""),
      Type.Null(),
    ]),
  ),
  twitter: Type.Optional(
    Type.Union([
      Type.String({
        format: "uri",
        errorMessage: "Twitter must be a valid URL",
      }),
      Type.Literal(""),
      Type.Null(),
    ]),
  ),
  facebook: Type.Optional(
    Type.Union([
      Type.String({
        format: "uri",
        errorMessage: "Facebook must be a valid URL",
      }),
      Type.Literal(""),
      Type.Null(),
    ]),
  ),
  linkedin: Type.Optional(
    Type.Union([
      Type.String({
        format: "uri",
        errorMessage: "LinkedIn must be a valid URL",
      }),
      Type.Literal(""),
      Type.Null(),
    ]),
  ),
  instagram: Type.Optional(
    Type.Union([
      Type.String({
        format: "uri",
        errorMessage: "Instagram must be a valid URL",
      }),
      Type.Literal(""),
      Type.Null(),
    ]),
  ),
});

export const UpdateProfileSchema = Type.Partial(CreateProfileSchema);

export const AddExperienceSchema = Type.Object({
  title: Type.String(),
  company: Type.String(),
  location: Type.Optional(Type.String()),
  from: Type.String({
    format: "date",
  }),
  to: Type.Optional(Type.String({ format: "date" })),
  current: Type.Optional(Type.Boolean({ default: false })),
  description: Type.Optional(Type.String()),
});

export const AddEducationSchema = Type.Object({
  school: Type.String(),
  degree: Type.String(),
  fieldofstudy: Type.String(),
  from: Type.String({ format: "date" }),
  to: Type.Optional(Type.String({ format: "date" })),
  current: Type.Optional(Type.Boolean({ default: false })),
  description: Type.Optional(Type.String()),
});

export type CreateProfileInput = Static<typeof CreateProfileSchema>;
export type AddExperienceInput = Static<typeof AddExperienceSchema>;
export type AddEducationInput = Static<typeof AddEducationSchema>;
