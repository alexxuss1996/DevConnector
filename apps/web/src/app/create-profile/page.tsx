"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { useForm } from "react-hook-form";
import { Box, Heading, Input, Text } from "@chakra-ui/react";
import { PageShell } from "@/components/shell/PageShell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { toaster } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api/client";
import { useCreateProfileMutation, useMyProfile } from "@/lib/queries";

interface ProfileValues {
  status: string;
  skills: string;
  company: string;
  location: string;
  bio: string;
}

function CreateProfileForm() {
  const router = useRouter();
  const [next] = useQueryState("next", { defaultValue: "/posts" });
  // 401/404 here are terminal (signed out / nothing created yet) — retries
  // would only stall the redirects below by seconds.
  const { data, error, isLoading } = useMyProfile({ retry: false });
  const createProfile = useCreateProfileMutation();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({
    defaultValues: { status: "", skills: "", company: "", location: "", bio: "" },
  });

  useEffect(() => {
    if (isLoading) return;
    if (error instanceof ApiError && error.status === 401) {
      router.replace(`/login?next=${encodeURIComponent("/create-profile")}`);
    } else if (data) {
      router.replace(next || "/posts");
    }
  }, [isLoading, error, data, router, next]);

  // Every state renders inside the shell, so the header and footer do not
  // flicker between the redirecting and the form state.
  const shell = (body: React.ReactNode) => (
    <PageShell maxW="560px">{body}</PageShell>
  );

  if (isLoading) return shell(<Skeleton height="32px" />);
  if (error instanceof ApiError && error.status === 401) return shell(null);
  if (data) return shell(null);
  if (error && !(error instanceof ApiError && error.status === 404)) {
    return shell(
      <EmptyState
        title="Something went wrong"
        description="Could not check your profile. Try again."
      />,
    );
  }

  const onSubmit = async (values: ProfileValues) => {
    const optional = (value: string) => {
      const trimmed = value.trim();
      return trimmed ? trimmed : undefined;
    };
    try {
      await createProfile.mutateAsync({
        status: values.status.trim(),
        skills: values.skills
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean),
        company: optional(values.company),
        location: optional(values.location),
        bio: optional(values.bio),
      });
      router.replace(next || "/posts");
    } catch (err) {
      const description =
        err instanceof ApiError && err.requestId
          ? `${err.message} (request ${err.requestId})`
          : err instanceof Error
            ? err.message
            : "Could not create profile";
      toaster.create({ title: "Could not create profile", description, type: "error" });
    }
  };

  return (
    <PageShell maxW="560px">
      <Box
        bg="panel"
        borderWidth="1px"
        borderColor="line"
        borderRadius="6px"
        p={{ base: 5, md: 8 }}
      >
        <Heading as="h1" size="lg" letterSpacing="-0.02em">
          Create your profile
        </Heading>
        <Text color="muted" fontSize="sm" mt={1} mb={6}>
          Status and skills are required. Everything else you can add later.
        </Text>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: "grid", gap: 16 }}>
          <Field label="Status" invalid={!!errors.status} errorText={errors.status?.message}>
            <Input
              {...register("status", { required: "Status is required" })}
              placeholder="Senior Backend Engineer"
            />
          </Field>
          <Field
            label="Skills"
            helperText="Comma-separated, e.g. TypeScript, Fastify, MongoDB"
            invalid={!!errors.skills}
            errorText={errors.skills?.message}
          >
            <Input
              {...register("skills", {
                required: "At least one skill is required",
                validate: (value) =>
                  value.split(",").some((skill) => skill.trim()) ||
                  "At least one skill is required",
              })}
              placeholder="TypeScript, Fastify"
            />
          </Field>
          <Field label="Company" invalid={!!errors.company} errorText={errors.company?.message}>
            <Input {...register("company")} placeholder="Northwind" />
          </Field>
          <Field label="Location" invalid={!!errors.location} errorText={errors.location?.message}>
            <Input {...register("location")} placeholder="Gdansk, PL" />
          </Field>
          <Field label="Bio" invalid={!!errors.bio} errorText={errors.bio?.message}>
            <Input {...register("bio")} placeholder="I build APIs and the tools around them." />
          </Field>
          <Button type="submit" loading={isSubmitting} colorPalette="brand">
            Save profile
          </Button>
        </form>
      </Box>
    </PageShell>
  );
}

export default function CreateProfilePage() {
  return (
    <Suspense>
      <CreateProfileForm />
    </Suspense>
  );
}
