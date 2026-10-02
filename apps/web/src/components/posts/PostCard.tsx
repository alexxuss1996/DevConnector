"use client";

import type { Post } from "@dev-conn/contracts";
import { Box, Flex, Text } from "@chakra-ui/react";
import { Avatar } from "@/components/ui/avatar";
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
    <Box
      as="article"
      data-testid="post-card"
      py={5}
      borderBottomWidth="1px"
      borderColor="line"
    >
      <Flex gap={3} align="start">
        <Avatar name={post.userId.name} size="sm" flexShrink={0} />

        <Box flex="1" minW={0}>
          <Text className="dc-mono" fontSize="xs" color="muted">
            {post.userId.name ?? "Developer"}
          </Text>

          <Button
            data-testid="post-open"
            variant="plain"
            onClick={() => onOpen(post._id)}
            h="auto"
            p={0}
            display="block"
            w="full"
            textAlign="left"
            fontFamily="body"
            fontSize="md"
            lineHeight="1.6"
            color="fg"
            whiteSpace="pre-wrap"
            overflowWrap="anywhere"
            mt={1}
          >
            {post.text}
          </Button>

          <Flex align="center" gap={2} mt={3}>
            <Button
              data-testid="like-button"
              size="xs"
              variant="ghost"
              colorPalette="brand"
              onClick={toggleLike}
            >
              {liked ? "Unlike" : "Like"}
            </Button>
            <Text className="dc-mono" fontSize="xs" color="muted">
              {post.likes.length} likes / {post.comments.length} comments
            </Text>
            {mine && (
              <Button
                data-testid="delete-button"
                size="xs"
                variant="ghost"
                ml="auto"
                onClick={remove}
              >
                Delete
              </Button>
            )}
          </Flex>
        </Box>
      </Flex>
    </Box>
  );
}
