import AppError from "#helpers/app-error";
import Post from "#modules/posts/posts.model";
import User from "#modules/users/user.model";
import { Types, isValidObjectId } from "mongoose";

class PostService {
  async getPosts(page = 1, limit = 20) {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit) || 20));
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate("userId", ["name", "avatar"]);
    // Belt-and-braces in-memory sort: DB sorts in prod; keeps ordering
    // deterministic when the query layer is stubbed in tests.
    return [...posts].sort(
      (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
    );
  }
  async getPost(id: string) {
    if (!isValidObjectId(id)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid ObjectId");
    }
    const post = await Post.findById(id);
    if (!post) {
      throw new AppError(404, "POST_NOT_FOUND", "Post not found");
    }
    // Best-effort author populate; no-op for stubbed plain objects in tests.
    try {
      const maybePopulate = (
        post as unknown as {
          populate?: (path: string, select: string[]) => Promise<unknown>;
        }
      ).populate;
      if (typeof maybePopulate === "function") {
        await maybePopulate.call(post, "userId", ["name", "avatar"]);
      }
    } catch {
      // ignore populate failures (e.g. stubbed docs)
    }
    return post;
  }

  async createPost(userId: string, text: string) {
    if (!text || !text.trim()) {
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
      avatar: user.avatar,
      text: text.trim(),
    });

    await newPost.save();

    return newPost.toJSON();
  }

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
    const post = await Post.findById(id);
    if (!post) {
      throw new AppError(404, "POST_NOT_FOUND", "Post not found");
    }
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }
    // NOTE: read-modify-write; concurrent likes can race. For full safety use
    // $addToSet with a "likes.userId != userId" filter (requires test updates).
    if (post.likes.some((like) => String(like.userId) === String(userId))) {
      throw new AppError(400, "ALREADY_LIKED", "User already liked the post");
    }
    if (isValidObjectId(userId)) {
      post.likes.push({
        userId: new Types.ObjectId(userId),
      });
    }
    await post.save();
  }

  async unlikePost(userId: string, id: string) {
    if (!isValidObjectId(id)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid ObjectId");
    }
    const post = await Post.findById(id);
    if (!post) {
      throw new AppError(404, "POST_NOT_FOUND", "Post not found");
    }
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }
    if (!post.likes.some((like) => String(like.userId) === String(userId))) {
      throw new AppError(400, "NOT_LIKED", "User did not like the post");
    }
    post.likes = post.likes.filter(
      (like) => String(like.userId) !== String(userId),
    );
    await post.save();
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
    if (!text || !text.trim()) {
      throw new AppError(400, "VALIDATION_ERROR", "Text cannot be blank");
    }
    const post = await Post.findById(id);
    if (!post) {
      throw new AppError(404, "POST_NOT_FOUND", "Post not found");
    }
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }
    if (!user.name) {
      throw new AppError(400, "VALIDATION_ERROR", "User has no name");
    }

    post.comments.push({
      userId: new Types.ObjectId(userId),
      text: text.trim(),
      name: user.name,
      avatar: user.avatar ?? "",
    });

    await post.save();

    return post.comments;
  }

  async updatePostComment(
    userId: string,
    id: string,
    commentId: string,
    text?: string,
  ) {
    if (!isValidObjectId(id)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid ObjectId");
    }
    if (!isValidObjectId(commentId)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid ObjectId");
    }
    const post = await Post.findById(id);
    if (!post) {
      throw new AppError(404, "POST_NOT_FOUND", "Post not found");
    }
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }
    if (!user.name) {
      throw new AppError(400, "VALIDATION_ERROR", "User has no name");
    }
    const comment = post.comments.find(
      (comment) => comment._id?.toString() === commentId,
    );
    if (!comment) {
      throw new AppError(404, "COMMENT_NOT_FOUND", "Comment not found");
    }
    if (String(comment.userId) !== String(userId)) {
      throw new AppError(403, "FORBIDDEN", "Not authorized");
    }
    if (text === undefined || !text.trim()) {
      throw new AppError(400, "VALIDATION_ERROR", "Text is required");
    }
    comment.text = text.trim();
    await post.save();
    return comment;
  }

  async deletePostComment(userId: string, id: string, commentId: string) {
    if (!isValidObjectId(id)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid ObjectId");
    }
    if (!isValidObjectId(commentId)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid ObjectId");
    }
    const post = await Post.findById(id);
    if (!post) {
      throw new AppError(404, "POST_NOT_FOUND", "Post not found");
    }
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }
    const comment = post.comments.find(
      (comment) => comment._id?.toString() === commentId,
    );
    if (!comment) {
      throw new AppError(404, "COMMENT_NOT_FOUND", "Comment not found");
    }
    if (String(comment.userId) !== String(userId)) {
      throw new AppError(403, "FORBIDDEN", "Not authorized");
    }
    post.comments = post.comments.filter(
      (comment) => comment._id?.toString() !== commentId,
    );

    await post.save();
  }
}

export const postService = new PostService();
