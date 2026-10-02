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
import { useRegisterMutation } from "@/lib/queries";

interface RegisterValues {
  name: string;
  email: string;
  password: string;
}

function RegisterForm() {
  const router = useRouter();
  const [next] = useQueryState("next", { defaultValue: "/posts" });
  const registerMutation = useRegisterMutation();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ defaultValues: { name: "", email: "", password: "" } });

  const onSubmit = async (values: RegisterValues) => {
    try {
      await registerMutation.mutateAsync(values);
      router.replace(`/create-profile?next=${encodeURIComponent(next || "/posts")}`);
    } catch (err) {
      const description =
        err instanceof ApiError && err.requestId
          ? `${err.message} (request ${err.requestId})`
          : err instanceof Error
            ? err.message
            : "Registration failed";
      toaster.create({ title: "Registration failed", description, type: "error" });
    }
  };

  return (
    <PageShell maxW="460px">
      <Box
        bg="panel"
        borderWidth="1px"
        borderColor="line"
        borderRadius="6px"
        p={{ base: 5, md: 8 }}
      >
        <Heading as="h1" size="lg" letterSpacing="-0.02em">
          Create account
        </Heading>
        <Text color="muted" fontSize="sm" mt={1} mb={6}>
          Pick a name and a password. You will add a profile in the next step.
        </Text>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: "grid", gap: 16 }}>
          <Field label="Name" invalid={!!errors.name} errorText={errors.name?.message}>
            <Input
              {...register("name", {
                required: "Name is required",
                minLength: { value: 3, message: "Name must be at least 3 characters" },
                maxLength: { value: 30, message: "Name must be at most 30 characters" },
                validate: (v) => /\S/.test(v) || "Name cannot be blank",
              })}
              placeholder="Alex Novak"
            />
          </Field>
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
          <Button type="submit" loading={isSubmitting} colorPalette="brand">
            Create account
          </Button>
        </form>

        <Text mt={5} fontSize="sm" color="muted">
          Already have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(next || "/posts")}`}>
            <Box as="span" color="brand.fg">
              Log in
            </Box>
          </Link>
        </Text>
      </Box>
    </PageShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
