"use client";

import NextLink from "next/link";
import { Box, Flex, Link as ChakraLink, Skeleton, Text } from "@chakra-ui/react";

import { Button } from "@/components/ui/button";
import { ColorModeButton } from "@/components/ui/color-mode";
import { ApiError } from "@/lib/api/client";
import { loginHref } from "@/lib/auth-redirect";
import { useLogoutMutation, useMyProfile } from "@/lib/queries";

export interface SiteHeaderProps {
  /** Replaces the session-aware actions (e.g. a route with its own chrome). */
  actions?: React.ReactNode;
}

/**
 * The header every route renders. One row, 56px, so it never eats the viewport;
 * the route tabs for signed-in pages live in the StatusBar directly beneath it
 * rather than crowding this row and forcing a second line on mobile.
 */
export function SiteHeader({ actions }: SiteHeaderProps) {
  return (
    <Box as="header">
      <Box maxW="1080px" mx="auto" px={{ base: 4, md: 6 }}>
        <Flex minH={14} align="center" justify="space-between" gap={4}>
          <ChakraLink asChild color="fg" textDecoration="none" _hover={{ textDecoration: "none" }}>
            <NextLink href="/" aria-label="DevConnector home">
              <Flex align="center" gap={2}>
                <Box aria-hidden boxSize="8px" bg="blue.solid" flexShrink={0} />
                <Text fontWeight="semibold" fontSize="sm" letterSpacing="-0.01em">
                  DevConnector
                </Text>
              </Flex>
            </NextLink>
          </ChakraLink>

          <Flex align="center" gap={{ base: 2, md: 3 }}>
            {actions ?? <SessionActions />}
            {/* Own chrome rather than part of `actions`, so the switch appears
                identically whether or not there is a session. */}
            <ColorModeButton size="sm" />
          </Flex>
        </Flex>
      </Box>
    </Box>
  );
}

function SessionActions() {
  const { data, error, isLoading } = useMyProfile({ retry: false });
  const logout = useLogoutMutation();

  // Same probe the pages use: 401 means signed out, 404 means signed in but
  // no profile yet.
  const signedIn =
    !!data || (error instanceof ApiError && error.status === 404);

  if (isLoading) return <Skeleton height="32px" width="80px" />;

  if (!signedIn) {
    return (
      <Button colorPalette="blue" size="sm" asChild>
        <NextLink href={loginHref("/")}>Sign in</NextLink>
      </Button>
    );
  }

  return (
    <>
      <Text fontSize="sm" color="muted" truncate>
        {data?.profile.userId.name ?? "Signed in"}
      </Text>
      <Button
        size="sm"
        variant="outline"
        loading={logout.isPending}
        onClick={() =>
          logout.mutate(undefined, {
            onSettled: () => window.location.assign("/"),
          })
        }
      >
        Sign out
      </Button>
    </>
  );
}