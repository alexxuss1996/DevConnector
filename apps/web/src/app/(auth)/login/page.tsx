"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { useForm } from "react-hook-form";
import { Box, Heading, Input, Text } from "@chakra-ui/react";
import { PageShell } from "@/components/shell/PageShell";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { toaster } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api/client";
import { useLoginMutation } from "@/lib/queries";

interface LoginValues {
  email: string;
  password: string;
}

function LoginForm() {
  const router = useRouter();
  const [next] = useQueryState("next", { defaultValue: "/posts" });
  const login = useLoginMutation();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ defaultValues: { email: "", password: "" } });

  const onSubmit = async (values: LoginValues) => {
    try {
      await login.mutateAsync(values);
      router.replace(next || "/posts");
    } catch (err) {
      const description =
        err instanceof ApiError && err.requestId
          ? `${err.message} (request ${err.requestId})`
          : err instanceof Error
            ? err.message
            : "Login failed";
      toaster.create({ title: "Login failed", description, type: "error" });
    }
  };

  return (
    <PageShell maxW="460px">
      <Box
        bg="bg.panel"
        borderWidth="1px"
        borderColor="border"
        borderRadius="6px"
        p={{ base: 5, md: 8 }}
      >
        <Heading as="h1" size="lg" letterSpacing="-0.02em">
          Log in
        </Heading>
        <Text color="muted" fontSize="sm" mt={1} mb={6}>
          Sign in to post updates and browse developers.
        </Text>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: "grid", gap: 16 }}>
          <Field label="Email" invalid={!!errors.email} errorText={errors.email?.message}>
            <Input
              type="email"
              {...register("email", {
                required: "Email is required",
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" },
              })}
              placeholder="you@example.com"
            />
          </Field>
          <Field label="Password" invalid={!!errors.password} errorText={errors.password?.message}>
            <PasswordInput
              {...register("password", {
                required: "Password is required",
                minLength: { value: 8, message: "Password must be at least 8 characters" },
                maxLength: { value: 255, message: "Password must be at most 255 characters" },
              })}
            />
          </Field>
          <Button type="submit" loading={isSubmitting} colorPalette="blue">
            Log in
          </Button>
        </form>

        <Text mt={5} fontSize="sm" color="muted">
          No account yet?{" "}
          <Link href={`/register?next=${encodeURIComponent(next || "/posts")}`}>
            <Box as="span" color="blue.solid">
              Create one
            </Box>
          </Link>
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
