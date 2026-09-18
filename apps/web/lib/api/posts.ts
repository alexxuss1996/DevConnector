import type {
  CreatePostInput,
  CreatePostCommentInput,
  UpdatePostCommentInput,
  PostIdParams,
  PostCommentIdParams,
} from "@dev-conn/contracts";
import { ApiClient, toQuery, type PaginationParams } from "./client";

export type Post = {
  _id: string;
  userId: string;
  name?: string;
  text: string;
  avatar?: string;
  likes: Array<{ userId: string }>;
  comments: Array<{
    _id: string;
    userId: string;
    text: string;
    name: string;
    avatar?: string;
    createdAt?: string;
    updatedAt?: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
};

export class PostsApiClient extends ApiClient {
  getPosts(params: PaginationParams = {}): Promise<{ posts: Post[] }> {
    return this.get<{ posts: Post[] }>(`/posts/${toQuery(params)}`);
  }

  getPost(params: PostIdParams): Promise<{ post: Post }> {
    return this.get<{ post: Post }>(`/posts/${params.id}`);
  }

  getPostComments(params: PostIdParams): Promise<{ comments: Post["comments"] }> {
    return this.get<{ comments: Post["comments"] }>(`/posts/${params.id}/comments`);
  }

  createPost(data: CreatePostInput): Promise<Post> {
    return this.post<Post>("/posts/", data);
  }

  deletePost(params: PostIdParams): Promise<void> {
    return this.delete<void>(`/posts/${params.id}`);
  }

  addComment(params: PostIdParams, data: CreatePostCommentInput): Promise<Post["comments"]> {
    return this.post<Post["comments"]>(`/posts/${params.id}/comments`, data);
  }

  updateComment(
    params: PostCommentIdParams,
    data: UpdatePostCommentInput,
  ): Promise<Post["comments"][number]> {
    return this.put<Post["comments"][number]>(
      `/posts/${params.id}/comments/${params.commentId}`,
      data,
    );
  }

  deleteComment(params: PostCommentIdParams): Promise<void> {
    return this.delete<void>(`/posts/${params.id}/comments/${params.commentId}`);
  }

  likePost(params: PostIdParams): Promise<void> {
    return this.put<void>(`/posts/${params.id}/like`);
  }

  unlikePost(params: PostIdParams): Promise<void> {
    return this.put<void>(`/posts/${params.id}/unlike`);
  }
}

/** Shared instance bound to the default API URL. */
export const postsApi = new PostsApiClient();
