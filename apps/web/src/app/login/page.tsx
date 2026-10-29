"use client";

import { Suspense, useState } from "react";
import NextLink from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Heading, Input, Text } from "@chakra-ui/react";

import { PageShell } from "@/components/shell/PageShell";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiError } from "@/lib/api/client";
import { safeNextPath } from "@/lib/auth-redirect";
import { useLoginMutation } from "@/lib/queries";

function LoginForm() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const login = useLoginMutation();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await login.mutateAsync({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      router.replace(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign in failed");
    }
  }

  return (
    <PageShell maxW="420px">
      <Box
        bg="bg.panel"
        borderWidth="1px"
        borderColor="border"
        borderRadius="6px"
        p={{ base: 5, md: 8 }}
      >
        <Heading as="h1" size="lg">
          Sign in
        </Heading>
        <Text color="muted" fontSize="sm" mt={1} mb={6}>
          Use your DevConnector account.
        </Text>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
          <Field label="Email">
            <Input name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label="Password">
            <PasswordInput
              name="password"
              required
              minLength={8}
              autoComplete="current-password"
            />
          </Field>

          {error && (
            <Text role="alert" color="red.500" fontSize="sm">
              {error}
            </Text>
          )}

          <Button type="submit" colorPalette="blue" loading={login.isPending}>
            Sign in
          </Button>
        </form>

        <Text mt={5} fontSize="sm" color="muted">
          <NextLink href="/">Back home</NextLink>
        </Text>
      </Box>
    </PageShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
