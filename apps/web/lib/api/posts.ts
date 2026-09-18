import type {
  CreatePostInput,
  CreatePostCommentInput,
  UpdatePostCommentInput,
  PostIdParams,
  PostCommentIdParams,
} from "@dev-conn/contracts";
import { apiFetch } from "./client";

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

export function getPosts(): Promise<{ posts: Post[] }> {
  return apiFetch<{ posts: Post[] }>("/posts/");
}

export function getPost(params: PostIdParams): Promise<{ post: Post }> {
  return apiFetch<{ post: Post }>(`/posts/${params.id}`);
}

export function getPostComments(params: PostIdParams): Promise<{ comments: Post["comments"] }> {
  return apiFetch<{ comments: Post["comments"] }>(`/posts/${params.id}/comments`);
}

export function createPost(data: CreatePostInput): Promise<Post> {
  return apiFetch<Post>("/posts/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deletePost(params: PostIdParams): Promise<void> {
  return apiFetch<void>(`/posts/${params.id}`, { method: "DELETE" });
}

export function addComment(params: PostIdParams, data: CreatePostCommentInput): Promise<Post["comments"]> {
  return apiFetch<Post["comments"]>(`/posts/${params.id}/comments`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateComment(params: PostCommentIdParams, data: UpdatePostCommentInput): Promise<Post["comments"][number]> {
  return apiFetch<Post["comments"][number]>(`/posts/${params.id}/comments/${params.commentId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteComment(params: PostCommentIdParams): Promise<void> {
  return apiFetch<void>(`/posts/${params.id}/comments/${params.commentId}`, { method: "DELETE" });
}

export function likePost(params: PostIdParams): Promise<void> {
  return apiFetch<void>(`/posts/${params.id}/like`, { method: "PUT" });
}

export function unlikePost(params: PostIdParams): Promise<void> {
  return apiFetch<void>(`/posts/${params.id}/unlike`, { method: "PUT" });
}
