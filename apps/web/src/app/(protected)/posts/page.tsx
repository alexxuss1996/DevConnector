"use client";

import { Suspense } from "react";
import { useQueryState } from "nuqs";
import { Box, Heading, Stack, Text } from "@chakra-ui/react";

import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PostCard } from "@/components/posts/PostCard";
import { PostComposer } from "@/components/posts/PostComposer";
import { PostDetailDialog } from "@/components/posts/PostDetailDialog";
import { usePosts } from "@/lib/queries";

function PostsContent() {
  const [postId, setPostId] = useQueryState("postId", { defaultValue: "" });
  const { data, isLoading, error } = usePosts();

  return (
    <Box data-testid="feed-column" maxW="680px" mx="auto" w="full">
      <Heading as="h1" size="xl" letterSpacing="-0.02em">
        Posts
      </Heading>
      <Text color="muted" mt={1} mb={8}>
        Updates from everyone on DevConnector.
      </Text>

      <Box
        bg="raised"
        borderWidth="1px"
        borderColor="line"
        borderRadius="6px"
        p={4}
        mb={8}
      >
        <PostComposer />
      </Box>

      {isLoading && <Skeleton height="20px" />}
      {error && (
        <EmptyState
          title="Something went wrong"
          description="Could not load posts. Try again."
        />
      )}
      {data && data.posts.length === 0 && (
        <EmptyState title="No posts yet" description="Be the first to share an update." />
      )}

      {/* One hairline-separated column rather than a stack of boxes, so the feed
          reads as a single chronicle instead of a pile of cards. */}
      <Stack gap={0} borderTopWidth="1px" borderColor="line">
        {data?.posts.map((post) => (
          <PostCard key={post._id} post={post} onOpen={(id) => void setPostId(id)} />
        ))}
      </Stack>

      {postId && <PostDetailDialog postId={postId} onClose={() => void setPostId("")} />}
    </Box>
  );
}

export default function PostsPage() {
  return (
    <Suspense fallback={<Skeleton height="20px" />}>
      <PostsContent />
    </Suspense>
  );
}