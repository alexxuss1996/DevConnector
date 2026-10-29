"use client";

import NextLink from "next/link";
import { Button, Heading, Skeleton, Stack, Text } from "@chakra-ui/react";

import { PageShell } from "@/components/shell/PageShell";
import { ApiError } from "@/lib/api/client";
import { useLogoutMutation, useMyProfile } from "@/lib/queries";

export default function HomePage() {
  const { data, error, isLoading } = useMyProfile({ retry: false });
  const logout = useLogoutMutation();

  // `/profiles/me` 401s when signed out and 404s when signed in without a
  // profile yet. Any other failure is treated as signed out so the page still
  // offers a way in.
  const signedIn =
    !!data || (error instanceof ApiError && error.status === 404);
  const signedOut = !isLoading && !signedIn;

  const headerActions = isLoading ? (
    <Skeleton height="32px" width="80px" />
  ) : signedOut ? (
    <Button size="sm" colorPalette="blue" asChild>
      <NextLink href="/login">Sign in</NextLink>
    </Button>
  ) : (
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

  return (
    <PageShell headerActions={headerActions}>
      <Stack gap={4} maxW="34rem">
        <Heading as="h1" size={{ base: "2xl", md: "3xl" }}>
          DevConnector
        </Heading>
        <Text color="muted">
          {isLoading
            ? "Checking session…"
            : signedOut
              ? "You are signed out."
              : "You are signed in."}
        </Text>
        {signedOut && (
          <Button colorPalette="blue" alignSelf="flex-start" asChild>
            <NextLink href="/login">Sign in</NextLink>
          </Button>
        )}
        {!isLoading && !signedOut && (
          <Button variant="outline" alignSelf="flex-start" asChild>
            <NextLink href="/dashboard">Open dashboard</NextLink>
          </Button>
        )}
      </Stack>
    </PageShell>
  );
}
