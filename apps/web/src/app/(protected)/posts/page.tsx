"use client";

import { Suspense } from "react";
import { useQueryState } from "nuqs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PostCard } from "@/components/posts/PostCard";
import { PostComposer } from "@/components/posts/PostComposer";
import { PostDetailDialog } from "@/components/posts/PostDetailDialog";
import { usePosts } from "@/lib/queries";

function PostsContent() {
  const [postId, setPostId] = useQueryState("postId", { defaultValue: "" });
  const { data, isLoading, error } = usePosts();

  return (
    <div style={{ display: "grid", gap: 24, maxWidth: 640 }}>
      <h1>Posts</h1>
      <PostComposer />
      {isLoading && <Skeleton height="20px" />}
      {error && (
        <EmptyState title="Something went wrong" description="Could not load posts. Try again." />
      )}
      {data && data.posts.length === 0 && (
        <EmptyState title="No posts yet" description="Be the first to share an update." />
      )}
      {data?.posts.map((post) => (
        <PostCard key={post._id} post={post} onOpen={(id) => void setPostId(id)} />
      ))}
      {postId && <PostDetailDialog postId={postId} onClose={() => void setPostId("")} />}
    </div>
  );
}

export default function PostsPage() {
  return (
    <Suspense fallback={<Skeleton height="20px" />}>
      <PostsContent />
    </Suspense>
  );
}
