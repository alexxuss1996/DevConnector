import { Static, Type } from "typebox";

const OBJECT_ID_PATTERN = "^[0-9a-fA-F]{24}$";
const NON_BLANK_PATTERN = ".*\\S.*";

export const CreatePostSchema = Type.Object(
  {
    text: Type.String({
      minLength: 1,
      maxLength: 5000,
      pattern: NON_BLANK_PATTERN,
      errorMessage: "Text is required, cannot be blank, max 5000 chars",
    }),
  },
  { additionalProperties: false },
);

export const CreatePostCommentSchema = Type.Object(
  {
    text: Type.String({
      minLength: 1,
      maxLength: 1000,
      pattern: NON_BLANK_PATTERN,
      errorMessage: "Text is required, cannot be blank, max 1000 chars",
    }),
  },
  { additionalProperties: false },
);

/** Comment subdocument as returned by the API (JSON-serialised Mongoose doc). */
export const CommentSchema = Type.Object(
  {
    _id: Type.String({ description: "ObjectId hex string" }),
    userId: Type.String({ description: "ObjectId hex string" }),
    text: Type.String(),
    name: Type.String(),
    avatar: Type.Optional(Type.String()),
    createdAt: Type.Optional(Type.String({ format: "date-time" })),
    updatedAt: Type.Optional(Type.String({ format: "date-time" })),
  },
  { additionalProperties: false },
);

/** Post document as returned by the API (JSON-serialised Mongoose doc). */
export const PostSchema = Type.Object(
  {
    _id: Type.String({ description: "ObjectId hex string" }),
    userId: Type.String({ description: "ObjectId hex string" }),
    name: Type.Optional(Type.String()),
    text: Type.String(),
    avatar: Type.Optional(Type.String()),
    likes: Type.Array(
      Type.Object({ userId: Type.String() }, { additionalProperties: false }),
    ),
    comments: Type.Array(CommentSchema),
    createdAt: Type.Optional(Type.String({ format: "date-time" })),
    updatedAt: Type.Optional(Type.String({ format: "date-time" })),
  },
  { additionalProperties: false },
);

export const UpdatePostSchema = Type.Object(
  {
    text: Type.Optional(
      Type.String({
        minLength: 1,
        maxLength: 5000,
        pattern: NON_BLANK_PATTERN,
        errorMessage: "Text cannot be blank, max 5000 chars",
      }),
    ),
  },
  { additionalProperties: false, minProperties: 1 },
);

export const UpdatePostCommentSchema = Type.Object(
  {
    text: Type.String({
      minLength: 1,
      maxLength: 1000,
      pattern: NON_BLANK_PATTERN,
      errorMessage: "Text cannot be blank, max 1000 chars",
    }),
  },
  { additionalProperties: false },
);

export type CreatePostInput = Static<typeof CreatePostSchema>;
export type UpdatePostInput = Static<typeof UpdatePostSchema>;
export type CreatePostCommentInput = Static<typeof CreatePostCommentSchema>;
export type UpdatePostCommentInput = Static<typeof UpdatePostCommentSchema>;

// Params schemas used by posts routes
export const PostIdParamsSchema = Type.Object({
  id: Type.String({
    pattern: OBJECT_ID_PATTERN,
    errorMessage: "Invalid ObjectId",
  }),
});

export const PostCommentIdParamsSchema = Type.Object({
  id: Type.String({
    pattern: OBJECT_ID_PATTERN,
    errorMessage: "Invalid ObjectId",
  }),
  commentId: Type.String({
    pattern: OBJECT_ID_PATTERN,
    errorMessage: "Invalid ObjectId",
  }),
});

export const GetPostCommentsParamsSchema = PostIdParamsSchema;
export const DeletePostParamsSchema = PostIdParamsSchema;
export const AddCommentParamsSchema = PostIdParamsSchema;
export const LikeUnlikeParamsSchema = PostIdParamsSchema;

export type PostIdParams = Static<typeof PostIdParamsSchema>;
export type PostCommentIdParams = Static<typeof PostCommentIdParamsSchema>;
export type Post = Static<typeof PostSchema>;
export type Comment = Static<typeof CommentSchema>;
