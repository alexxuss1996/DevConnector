import { Static, Type } from "typebox";

export const CreatePostSchema = Type.Object({
  text: Type.String({
    minLength: 1,
    errorMessage: "Text is required and cannot be empty",
  }),
});

export const CreatePostCommentSchema = Type.Object({
  text: Type.String({
    minLength: 1,
    errorMessage: "Text is required and cannot be empty",
  }),
});

export const UpdatePostSchema = Type.Partial(CreatePostSchema);

export const UpdatePostCommentSchema = Type.Partial(CreatePostCommentSchema);

export type CreatePostInput = Static<typeof CreatePostSchema>;
export type UpdatePostInput = Static<typeof UpdatePostSchema>;
