import AppError from "#helpers/app-error";
import Post from "#modules/posts/posts.model";
import User from "#modules/users/user.model";
import { Types, isValidObjectId } from "mongoose";
import { sanitizeText } from "#helpers/sanitize";

class PostService {
  async getPosts(page = 1, limit = 20) {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit) || 20));
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate("userId", ["name", "avatar"]);
    return posts;
  }
  async getPost(id: string) {
    if (!isValidObjectId(id)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid ObjectId");
    }
    const post = await Post.findById(id).populate("userId", ["name", "avatar"]);
    if (!post) {
      throw new AppError(404, "POST_NOT_FOUND", "Post not found");
    }
    return post;
  }

  async createPost(userId: string, text: string) {
    const sanitizedText = sanitizeText(text);
    if (!sanitizedText || !sanitizedText.trim()) {
      throw new AppError(400, "VALIDATION_ERROR", "Text cannot be blank");
    }
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    if (!user.name) {
      throw new AppError(400, "VALIDATION_ERROR", "User has no name");
    }
    const newPost = new Post({
      userId,
      name: user.name,
      avatar: user.avatar ?? "",
      text: sanitizedText,
    });

    await newPost.save();

    return newPost.toJSON();
  }

  /**
   * Deletes a post owned by `userId`. Returns 404 for both missing and
   * not-owned posts (idempotent delete, avoids enumerating other users'
   * post ids). Comment writes return 403 instead because they need to
   * distinguish "no such comment" from "not yours".
   */
  async deletePost(userId: string, id: string) {
    if (!isValidObjectId(id)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid ObjectId");
    }
    const post = await Post.findOneAndDelete({ _id: id, userId });
    if (!post) {
      throw new AppError(404, "POST_NOT_FOUND", "Post not found");
    }
  }

  async likePost(userId: string, id: string) {
    if (!isValidObjectId(id)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid ObjectId");
    }
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }
    // Atomic: the filter only matches when not already liked, so concurrent
    // requests cannot create duplicate likes.
    const post = await Post.findOneAndUpdate(
      { _id: id, "likes.userId": { $ne: new Types.ObjectId(userId) } },
      {
        $addToSet: { likes: { userId: new Types.ObjectId(userId) } },
        $set: { updatedAt: new Date() },
      },
      { new: true },
    );
    if (!post) {
      const exists = await Post.exists({ _id: id });
      if (!exists) {
        throw new AppError(404, "POST_NOT_FOUND", "Post not found");
      }
      throw new AppError(400, "ALREADY_LIKED", "User already liked the post");
    }
  }

  async unlikePost(userId: string, id: string) {
    if (!isValidObjectId(id)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid ObjectId");
    }
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }
    const post = await Post.findOneAndUpdate(
      { _id: id, "likes.userId": new Types.ObjectId(userId) },
      {
        $pull: { likes: { userId: new Types.ObjectId(userId) } },
        $set: { updatedAt: new Date() },
      },
      { new: true },
    );
    if (!post) {
      const exists = await Post.exists({ _id: id });
      if (!exists) {
        throw new AppError(404, "POST_NOT_FOUND", "Post not found");
      }
      throw new AppError(400, "NOT_LIKED", "User did not like the post");
    }
  }

  async getPostComments(id: string) {
    if (!isValidObjectId(id)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid ObjectId");
    }
    const post = await Post.findById(id);
    if (!post) {
      throw new AppError(404, "POST_NOT_FOUND", "Post not found");
    }
    return post.comments;
  }

  async createPostComment(userId: string, id: string, text: string) {
    if (!isValidObjectId(id)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid ObjectId");
    }
    const sanitizedText = sanitizeText(text);
    if (!sanitizedText || !sanitizedText.trim()) {
      throw new AppError(400, "VALIDATION_ERROR", "Text cannot be blank");
    }
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }
    if (!user.name) {
      throw new AppError(400, "VALIDATION_ERROR", "User has no name");
    }

    // Atomic $push: concurrent comments can no longer overwrite each other.
    const post = await Post.findOneAndUpdate(
      { _id: id },
      {
        $push: {
          comments: {
            userId: new Types.ObjectId(userId),
            text: sanitizedText,
            name: user.name,
            avatar: user.avatar ?? "",
          },
        },
        $set: { updatedAt: new Date() },
      },
      { new: true },
    );
    if (!post) {
      throw new AppError(404, "POST_NOT_FOUND", "Post not found");
    }

    return post.comments;
  }

  async updatePostComment(
    userId: string,
    id: string,
    commentId: string,
    text: string,
  ) {
    if (!isValidObjectId(id)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid ObjectId");
    }
    if (!isValidObjectId(commentId)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid ObjectId");
    }
    const sanitizedText = sanitizeText(text);
    if (!sanitizedText.trim()) {
      throw new AppError(400, "VALIDATION_ERROR", "Text is required");
    }
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }
    if (!user.name) {
      throw new AppError(400, "VALIDATION_ERROR", "User has no name");
    }
    // Atomic ownership-checked update via the positional operator.
    const post = await Post.findOneAndUpdate(
      {
        _id: id,
        comments: { $elemMatch: { _id: commentId, userId: user._id } },
      },
      { $set: { "comments.$.text": sanitizedText, updatedAt: new Date() } },
      { new: true },
    );
    if (post) {
      return post.comments.find(
        (comment) => comment._id?.toString() === commentId,
      )!;
    }
    throw await this.resolveCommentWriteFailure(id, commentId);
  }

  async deletePostComment(userId: string, id: string, commentId: string) {
    if (!isValidObjectId(id)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid ObjectId");
    }
    if (!isValidObjectId(commentId)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid ObjectId");
    }
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }
    // Atomic ownership-checked delete.
    const post = await Post.findOneAndUpdate(
      {
        _id: id,
        comments: { $elemMatch: { _id: commentId, userId: user._id } },
      },
      {
        $pull: { comments: { _id: commentId } },
        $set: { updatedAt: new Date() },
      },
      { new: true },
    );
    if (post) return;
    throw await this.resolveCommentWriteFailure(id, commentId);
  }

  /**
   * Maps a failed ownership-checked comment write to the precise error.
   * Only runs on the failure path, so the extra read is rare.
   */
  private async resolveCommentWriteFailure(
    id: string,
    commentId: string,
  ): Promise<AppError> {
    const existing = await Post.findById(id);
    if (!existing) {
      return new AppError(404, "POST_NOT_FOUND", "Post not found");
    }
    const commentExists = existing.comments.some(
      (comment) => comment._id?.toString() === commentId,
    );
    if (!commentExists) {
      return new AppError(404, "COMMENT_NOT_FOUND", "Comment not found");
    }
    return new AppError(403, "FORBIDDEN", "Not authorized");
  }
}

export const postService = new PostService();
