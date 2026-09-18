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
export type CreatePostCommentInput = Static<typeof CreatePostCommentSchema>;
export type UpdatePostCommentInput = Static<typeof UpdatePostCommentSchema>;

// Params schemas used by posts routes
export const PostIdParamsSchema = Type.Object({
  id: Type.String({
    minLength: 1,
    errorMessage: "ID must be at least 1 character",
  }),
});

export const PostCommentIdParamsSchema = Type.Object({
  id: Type.String({
    minLength: 1,
    errorMessage: "ID must be at least 1 character",
  }),
  commentId: Type.String({
    minLength: 1,
    errorMessage: "Comment ID must be at least 1 character",
  }),
});

export const GetPostCommentsParamsSchema = PostIdParamsSchema;
export const DeletePostParamsSchema = PostIdParamsSchema;
export const AddCommentParamsSchema = PostIdParamsSchema;
export const LikeUnlikeParamsSchema = PostIdParamsSchema;

export type PostIdParams = Static<typeof PostIdParamsSchema>;
export type PostCommentIdParams = Static<typeof PostCommentIdParamsSchema>;
