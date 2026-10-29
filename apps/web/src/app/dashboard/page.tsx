"use client";

import NextLink from "next/link";
import { Heading, Stack, Text } from "@chakra-ui/react";

import { PageShell } from "@/components/shell/PageShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { loginHref } from "@/lib/auth-redirect";
import { useMyProfile } from "@/lib/queries";

export default function DashboardPage() {
  const { data, error, isLoading } = useMyProfile({ retry: false });

  // `/profiles/me` 401s when signed out and 404s when signed in without a
  // profile yet; both are a valid session answer for this page.
  const signedIn =
    !!data || (error instanceof ApiError && error.status === 404);
  const signedOut = !isLoading && !signedIn;

  if (isLoading) {
    return (
      <PageShell>
        <Skeleton height="40px" maxW="20rem" />
      </PageShell>
    );
  }

  if (signedOut) {
    return (
      <PageShell>
        <Stack gap={4} maxW="34rem">
          <Heading as="h1" size="xl">
            Access denied
          </Heading>
          <Text color="muted">Sign in to view this page.</Text>
          <Button colorPalette="blue" alignSelf="flex-start" asChild>
            <NextLink href={loginHref("/dashboard")}>Sign in</NextLink>
          </Button>
        </Stack>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Stack gap={4} maxW="34rem">
        <Heading as="h1" size="xl">
          Dashboard
        </Heading>
        <Text color="muted">
          {data
            ? `Signed in as ${data.profile.userId.name ?? "a developer"}.`
            : "Signed in. No profile created yet."}
        </Text>
        <Button variant="outline" alignSelf="flex-start" asChild>
          <NextLink href="/">Back home</NextLink>
        </Button>
      </Stack>
    </PageShell>
  );
}
