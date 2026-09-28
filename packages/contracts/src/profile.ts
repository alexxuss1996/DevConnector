import { Static, Type } from "typebox";

export const CreateProfileSchema = Type.Object(
  {
    company: Type.Optional(
      Type.Union([
        Type.String({
          minLength: 1,
          description: "Company name",
          examples: ["Acme Corp"],
          example: "Acme Corp",
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
          description: "Personal or company website",
          examples: ["https://example.com"],
          example: "https://example.com",
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
          description: "Location, e.g. Seattle, WA",
          examples: ["Seattle, WA"],
          example: "Seattle, WA",
          errorMessage: "Location must be at least 1 character",
        }),
        Type.Literal(""),
        Type.Null(),
      ]),
    ),
    status: Type.String({
      minLength: 1,
      pattern: ".*\\S.*",
      description:
        "Professional status - e.g. Developer, Junior Developer, Senior Developer, Manager, Student",
      examples: ["Developer"],
      example: "Developer",
      errorMessage: "Status is required and cannot be empty",
    }),
    skills: Type.Array(
      Type.String({
        minLength: 1,
        pattern: ".*\\S.*",
        description: "A skill",
        examples: ["JavaScript"],
        example: "JavaScript",
        errorMessage: "Skill cannot be empty",
      }),
      {
        minItems: 1,
        description: "List of skills",
        examples: [["JavaScript", "Node.js", "React"]],
        example: ["JavaScript", "Node.js", "React"],
        errorMessage: "At least one skill is required",
      },
    ),
    bio: Type.Optional(
      Type.Union([
        Type.String({
          minLength: 1,
          maxLength: 500,
          description: "Short bio",
          examples: ["Full-stack developer passionate about open source"],
          example: "Full-stack developer passionate about open source",
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
          description: "GitHub username",
          examples: ["octocat"],
          example: "octocat",
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
          description: "YouTube channel URL",
          examples: ["https://youtube.com/@example"],
          example: "https://youtube.com/@example",
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
          description: "Twitter / X profile URL",
          examples: ["https://twitter.com/example"],
          example: "https://twitter.com/example",
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
          description: "Facebook profile URL",
          examples: ["https://facebook.com/example"],
          example: "https://facebook.com/example",
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
          description: "LinkedIn profile URL",
          examples: ["https://linkedin.com/in/example"],
          example: "https://linkedin.com/in/example",
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
          description: "Instagram profile URL",
          examples: ["https://instagram.com/example"],
          example: "https://instagram.com/example",
          errorMessage: "Instagram must be a valid URL",
        }),
        Type.Literal(""),
        Type.Null(),
      ]),
    ),
  },
  {
    description: "Profile creation payload",
    additionalProperties: false,
    examples: [
      {
        company: "Acme Corp",
        website: "https://example.com",
        location: "Seattle, WA",
        status: "Developer",
        skills: ["JavaScript", "Node.js", "React"],
        bio: "Full-stack developer passionate about open source",
        githubusername: "octocat",
        youtube: "https://youtube.com/@example",
        twitter: "https://twitter.com/example",
        facebook: "https://facebook.com/example",
        linkedin: "https://linkedin.com/in/example",
        instagram: "https://instagram.com/example",
      },
    ],
    example: {
      company: "Acme Corp",
      website: "https://example.com",
      location: "Seattle, WA",
      status: "Developer",
      skills: ["JavaScript", "Node.js", "React"],
      bio: "Full-stack developer passionate about open source",
      githubusername: "octocat",
    },
  },
);

export const UpdateProfileSchema = Type.Partial(CreateProfileSchema, {
  additionalProperties: false,
  minProperties: 1,
});

const NonBlankString = (description: string, examples: string[]) =>
  Type.String({
    minLength: 1,
    pattern: ".*\\S.*",
    description,
    examples,
    example: examples[0],
    errorMessage: `${description} is required and cannot be blank`,
  });

export const AddExperienceSchema = Type.Object(
  {
    title: NonBlankString("Job title", ["Senior Developer"]),
    company: NonBlankString("Company name", ["Acme Corp"]),
    location: Type.Optional(Type.String({ description: "Location", examples: ["Seattle, WA"], example: "Seattle, WA" })),
    from: Type.String({
      format: "date",
      description: "Start date (YYYY-MM-DD)",
      examples: ["2022-01-15"],
      example: "2022-01-15",
    }),
    to: Type.Optional(
      Type.String({ format: "date", description: "End date (YYYY-MM-DD)", examples: ["2024-06-30"], example: "2024-06-30" }),
    ),
    current: Type.Optional(Type.Boolean({ description: "Current job", default: false, examples: [false], example: false })),
    description: Type.Optional(
      Type.String({
        description: "Role description",
        examples: ["Built scalable APIs with Fastify and MongoDB"],
        example: "Built scalable APIs with Fastify and MongoDB",
      }),
    ),
  },
  { additionalProperties: false },
);

export const AddEducationSchema = Type.Object(
  {
    school: NonBlankString("School or university", ["MIT"]),
    degree: NonBlankString("Degree", ["Bachelor of Science"]),
    fieldofstudy: NonBlankString("Field of study", ["Computer Science"]),
    from: Type.String({ format: "date", description: "Start date (YYYY-MM-DD)", examples: ["2018-09-01"], example: "2018-09-01" }),
    to: Type.Optional(
      Type.String({ format: "date", description: "End date (YYYY-MM-DD)", examples: ["2022-06-15"], example: "2022-06-15" }),
    ),
    current: Type.Optional(Type.Boolean({ description: "Currently studying", default: false, examples: [false], example: false })),
    description: Type.Optional(
      Type.String({
        description: "Program description",
        examples: ["Focused on distributed systems and databases"],
        example: "Focused on distributed systems and databases",
      }),
    ),
  },
  { additionalProperties: false },
);

// Params schemas used by profile routes
export const ProfileIdParamsSchema = Type.Object({
  id: Type.String({
    pattern: "^[0-9a-fA-F]{24}$",
    errorMessage: "Invalid ObjectId",
  }),
});

export const GithubUsernameParamsSchema = Type.Object({
  username: Type.String({
    minLength: 1,
    maxLength: 39,
    pattern: "^[a-zA-Z0-9-]+$",
    errorMessage: "Invalid GitHub username",
  }),
});

export const ExperienceIdParamsSchema = Type.Object({
  experienceId: Type.String({
    pattern: "^[0-9a-fA-F]{24}$",
    errorMessage: "Invalid ObjectId",
  }),
});

export const EducationIdParamsSchema = Type.Object({
  educationId: Type.String({
    pattern: "^[0-9a-fA-F]{24}$",
    errorMessage: "Invalid ObjectId",
  }),
});

export type CreateProfileInput = Static<typeof CreateProfileSchema>;
export type UpdateProfileInput = Static<typeof UpdateProfileSchema>;
export type AddExperienceInput = Static<typeof AddExperienceSchema>;
export type AddEducationInput = Static<typeof AddEducationSchema>;
export type ProfileIdParams = Static<typeof ProfileIdParamsSchema>;
export type GithubUsernameParams = Static<typeof GithubUsernameParamsSchema>;
export type ExperienceIdParams = Static<typeof ExperienceIdParamsSchema>;
export type EducationIdParams = Static<typeof EducationIdParamsSchema>;

/** Experience subdocument as returned by the API (JSON-serialised Mongoose doc). */
export const ExperienceSchema = Type.Object(
  {
    _id: Type.Optional(Type.String({ description: "ObjectId hex string" })),
    title: NonBlankString("Job title", ["Senior Developer"]),
    company: NonBlankString("Company name", ["Acme Corp"]),
    location: Type.Optional(Type.String({ description: "Location", examples: ["Seattle, WA"], example: "Seattle, WA" })),
    from: Type.String({ format: "date", description: "Start date (YYYY-MM-DD)", examples: ["2022-01-15"], example: "2022-01-15" }),
    to: Type.Optional(Type.String({ format: "date", description: "End date (YYYY-MM-DD)", examples: ["2024-06-30"], example: "2024-06-30" })),
    current: Type.Optional(Type.Boolean({ description: "Current job", default: false, examples: [false], example: false })),
    description: Type.Optional(Type.String({ description: "Role description", examples: ["Built scalable APIs with Fastify and MongoDB"], example: "Built scalable APIs with Fastify and MongoDB" })),
  },
  { additionalProperties: false },
);

/** Education subdocument as returned by the API (JSON-serialised Mongoose doc). */
export const EducationSchema = Type.Object(
  {
    _id: Type.Optional(Type.String({ description: "ObjectId hex string" })),
    school: NonBlankString("School or university", ["MIT"]),
    degree: NonBlankString("Degree", ["Bachelor of Science"]),
    fieldofstudy: NonBlankString("Field of study", ["Computer Science"]),
    from: Type.String({ format: "date", description: "Start date (YYYY-MM-DD)", examples: ["2018-09-01"], example: "2018-09-01" }),
    to: Type.Optional(Type.String({ format: "date", description: "End date (YYYY-MM-DD)", examples: ["2022-06-15"], example: "2022-06-15" })),
    current: Type.Optional(Type.Boolean({ description: "Currently studying", default: false, examples: [false], example: false })),
    description: Type.Optional(Type.String({ description: "Program description", examples: ["Focused on distributed systems and databases"], example: "Focused on distributed systems and databases" })),
  },
  { additionalProperties: false },
);

/**
 * The profile owner as returned by the profile GET endpoints, which populate
 * `userId` with the user's `_id`, `name` and `avatar` instead of the bare id
 * stored on the document. This is why the response schemas below model
 * `userId` as an object rather than an ObjectId string.
 */
export const ProfileOwnerSchema = Type.Object(
  {
    _id: Type.String({ description: "ObjectId hex string" }),
    name: Type.Optional(Type.String()),
    avatar: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export type ProfileOwner = Static<typeof ProfileOwnerSchema>;

/** Optional profile text fields, stored unset when the value is blank. */
const OptionalText = (description: string, examples: string[]) =>
  Type.Optional(
    Type.Union(
      [Type.String({ description, examples }), Type.Literal(""), Type.Null()],
      { default: undefined },
    ),
  );

/**
 * A profile as returned by the single-profile reads (`GET /profiles/user/:id`,
 * `GET /profiles/me`) and every profile write. Declared with
 * `additionalProperties: false` so the Fastify response serializer strips
 * anything not listed here.
 */
export const PublicProfileSchema = Type.Object(
  {
    _id: Type.String({ description: "ObjectId hex string" }),
    userId: ProfileOwnerSchema,
    company: OptionalText("Company name", ["Acme Corp"]),
    website: OptionalText("Personal or company website", ["https://example.com"]),
    location: OptionalText("Location, e.g. Seattle, WA", ["Seattle, WA"]),
    status: Type.String({ minLength: 1, pattern: ".*\\S.*", description: "Professional status" }),
    skills: Type.Array(
      Type.String({ minLength: 1, pattern: ".*\\S.*", description: "A skill" }),
      { minItems: 1 },
    ),
    bio: OptionalText("Short bio", ["Full-stack developer"]),
    githubusername: OptionalText("GitHub username", ["octocat"]),
    experience: Type.Array(ExperienceSchema),
    education: Type.Array(EducationSchema),
    social: Type.Object(
      {
        youtube: Type.Optional(Type.String()),
        twitter: Type.Optional(Type.String()),
        facebook: Type.Optional(Type.String()),
        linkedin: Type.Optional(Type.String()),
        instagram: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
    createdAt: Type.Optional(Type.String({ format: "date-time", description: "ISO timestamp" })),
    updatedAt: Type.Optional(Type.String({ format: "date-time", description: "ISO timestamp" })),
  },
  { additionalProperties: false },
);

/**
 * The subset a directory listing needs. `GET /profiles/` projects down to
 * this, so the heavy subdocuments (`experience`, `education`) and the private
 * `social` block are never sent for a list page.
 */
export const PublicProfileSummarySchema = Type.Object(
  {
    _id: Type.String({ description: "ObjectId hex string" }),
    userId: ProfileOwnerSchema,
    status: Type.String({ minLength: 1, pattern: ".*\\S.*", description: "Professional status" }),
    company: OptionalText("Company name", ["Acme Corp"]),
    location: OptionalText("Location, e.g. Seattle, WA", ["Seattle, WA"]),
    skills: Type.Array(
      Type.String({ minLength: 1, pattern: ".*\\S.*", description: "A skill" }),
      { minItems: 1 },
    ),
  },
  { additionalProperties: false },
);

export const ProfileResponseSchema = Type.Object(
  { profile: PublicProfileSchema },
  { additionalProperties: false },
);

export const ProfileListResponseSchema = Type.Object(
  {
    profiles: Type.Array(PublicProfileSummarySchema),
    total: Type.Integer({ minimum: 0, description: "Total profiles matching the query" }),
    page: Type.Integer({ minimum: 1 }),
    limit: Type.Integer({ minimum: 1, maximum: 100 }),
  },
  { additionalProperties: false },
);

export type PublicProfile = Static<typeof PublicProfileSchema>;
export type PublicProfileSummary = Static<typeof PublicProfileSummarySchema>;
export type ProfileResponse = Static<typeof ProfileResponseSchema>;
export type ProfileListResponse = Static<typeof ProfileListResponseSchema>;
export type Experience = Static<typeof ExperienceSchema>;
export type Education = Static<typeof EducationSchema>;

/**
 * Error body shared by every endpoint. `additionalProperties: true` on purpose:
 * validation failures add `issues` and `fieldErrors`, and a strict schema here
 * would silently strip them.
 */
export const ErrorResponseSchema = Type.Object(
  {
    code: Type.String({ description: "Stable machine-readable error code" }),
    message: Type.String(),
    requestId: Type.Optional(Type.String({ description: "Echoes X-Request-Id" })),
  },
  { additionalProperties: true },
);

export type ErrorResponse = Static<typeof ErrorResponseSchema>;

/**
 * Pagination query string. The API receives querystring values as strings and
 * AJV runs with `coerceTypes: false`, so each field accepts a string or an
 * integer and the handler normalises it.
 */
export const PaginationQuerySchema = Type.Object(
  {
    page: Type.Optional(
      Type.Union([Type.Integer({ minimum: 1 }), Type.String({ minLength: 1 })], {
        default: 1,
        description: "1-based page number",
      }),
    ),
    limit: Type.Optional(
      Type.Union([Type.Integer({ minimum: 1, maximum: 100 }), Type.String({ minLength: 1 })], {
        default: 20,
        description: "Page size, 1-100",
      }),
    ),
  },
  { additionalProperties: false },
);

export interface PaginationQuery {
  page?: number | string;
  limit?: number | string;
}

/** Normalises a pagination query to safe integers, clamped to `limit` 1-100. */
export function parsePagination(query: PaginationQuery = {}): { page: number; limit: number } {
  const toInt = (value: unknown, fallback: number) => {
    const n = typeof value === "string" ? Number(value) : (value as number);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return fallback;
    return n;
  };
  const page = Math.max(1, toInt(query.page, 1));
  const limit = Math.min(100, Math.max(1, toInt(query.limit, 20)));
  return { page, limit };
}

