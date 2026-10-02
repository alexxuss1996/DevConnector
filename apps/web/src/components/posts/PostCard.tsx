"use client";

import type { Post } from "@dev-conn/contracts";
import { Button } from "@/components/ui/button";
import { toaster } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api/client";
import { useUnauthorizedRedirect } from "@/lib/auth-redirect";
import {
  useDeletePostMutation,
  useLikePostMutation,
  useMyProfile,
  useUnlikePostMutation,
} from "@/lib/queries";

function errorDescription(err: unknown, fallback: string) {
  return err instanceof ApiError && err.requestId
    ? `${err.message} (request ${err.requestId})`
    : err instanceof Error
      ? err.message
      : fallback;
}

export function PostCard({ post, onOpen }: { post: Post; onOpen: (id: string) => void }) {
  const likePost = useLikePostMutation();
  const unlikePost = useUnlikePostMutation();
  const deletePost = useDeletePostMutation();
  const redirectIfExpired = useUnauthorizedRedirect();
  const { data } = useMyProfile();
  const myId = data?.profile.userId._id;
  const liked = myId ? post.likes.some((l) => l.userId === myId) : false;
  const mine = myId === post.userId._id;

  const toggleLike = async () => {
    try {
      if (liked) await unlikePost.mutateAsync({ id: post._id });
      else await likePost.mutateAsync({ id: post._id });
    } catch (err) {
      if (redirectIfExpired(err)) return;
      toaster.create({ title: "Could not update like", description: errorDescription(err, "Try again"), type: "error" });
    }
  };

  const remove = async () => {
    try {
      await deletePost.mutateAsync({ id: post._id });
    } catch (err) {
      if (redirectIfExpired(err)) return;
      toaster.create({ title: "Could not delete post", description: errorDescription(err, "Try again"), type: "error" });
    }
  };

  return (
    <article data-testid="post-card" style={{ display: "grid", gap: 8 }}>
      <button
        type="button"
        data-testid="post-open"
        onClick={() => onOpen(post._id)}
        style={{ textAlign: "left", cursor: "pointer", background: "none", border: "none", padding: 0 }}
      >
        {post.text}
      </button>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Button data-testid="like-button" size="sm" variant="ghost" onClick={toggleLike}>
          {liked ? "Unlike" : "Like"} ({post.likes.length})
        </Button>
        <span>{post.comments.length} comments</span>
        {mine && (
          <Button data-testid="delete-button" size="sm" variant="ghost" onClick={remove}>
            Delete
          </Button>
        )}
      </div>
    </article>
  );
}
