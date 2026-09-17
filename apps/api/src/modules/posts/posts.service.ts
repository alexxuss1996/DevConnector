import AppError from "#helpers/app-error";
import Post from "#modules/posts/posts.model";
import User from "#modules/users/user.model";
import { Types, isValidObjectId } from "mongoose";

class PostService {
  async getPosts() {
    const posts = (
      await Post.find().populate("userId", ["name", "avatar"])
    ).sort(
      (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
    );
    return posts;
  }
  async getPost(id: string) {
    const post = await Post.findById(id);
    if (!post) {
      throw new AppError(404, "POST_NOT_FOUND", "Post not found");
    }
    return post;
  }

  async createPost(userId: string, text: string) {
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
      text,
    });

    await newPost.save();

    return newPost.toJSON();
  }

  async deletePost(userId: string) {
    const post = await Post.findOneAndDelete({ userId });
    if (!post) {
      throw new AppError(404, "POST_NOT_FOUND", "Post not found");
    }
  }

  async likePost(userId: string, id: string) {
    const post = await Post.findById(id);
    if (!post) {
      throw new AppError(404, "POST_NOT_FOUND", "Post not found");
    }
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }
    if (post.likes.some((like) => like.userId.equals(userId))) {
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
    const post = await Post.findById(id);
    if (!post) {
      throw new AppError(404, "POST_NOT_FOUND", "Post not found");
    }
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }
    if (!post.likes.some((like) => like.userId.equals(userId))) {
      throw new AppError(400, "NOT_LIKED", "User did not like the post");
    }
    post.likes = post.likes.filter((like) => !like.userId.equals(userId));
    await post.save();
  }

  async getPostComments(id: string) {
    const post = await Post.findById(id);
    if (!post) {
      throw new AppError(404, "POST_NOT_FOUND", "Post not found");
    }
    return post.comments;
  }

  async createPostComment(userId: string, id: string, text: string) {
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
      text,
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
    if (!comment.userId.equals(userId)) {
      throw new AppError(403, "FORBIDDEN", "Not authorized");
    }
    if (text) {
      comment.text = text;
    }
    await post.save();
    return comment;
  }

  async deletePostComment(userId: string, id: string, commentId: string) {
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
    if (!comment.userId.equals(userId)) {
      throw new AppError(403, "FORBIDDEN", "Not authorized");
    }
    post.comments = post.comments.filter(
      (comment) => comment._id?.toString() !== commentId,
    );

    await post.save();
  }
}

export const postService = new PostService();
