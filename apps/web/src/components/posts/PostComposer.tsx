"use client";

import { Textarea } from "@chakra-ui/react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { toaster } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api/client";
import { useUnauthorizedRedirect } from "@/lib/auth-redirect";
import { useCreatePostMutation } from "@/lib/queries";

interface ComposerValues {
  text: string;
}

export function PostComposer({ onCreated }: { onCreated?: () => void }) {
  const createPost = useCreatePostMutation();
  const redirectIfExpired = useUnauthorizedRedirect();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ComposerValues>({ defaultValues: { text: "" } });

  const onSubmit = async (values: ComposerValues) => {
    try {
      await createPost.mutateAsync({ text: values.text });
      reset();
      onCreated?.();
    } catch (err) {
      if (redirectIfExpired(err)) return;
      const description =
        err instanceof ApiError && err.requestId
          ? `${err.message} (request ${err.requestId})`
          : err instanceof Error
            ? err.message
            : "Could not create post";
      toaster.create({ title: "Could not create post", description, type: "error" });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: "grid", gap: 12 }}>
      <Field label="New post" invalid={!!errors.text} errorText={errors.text?.message}>
        <Textarea
          {...register("text", {
            required: "Post cannot be blank",
            maxLength: { value: 5000, message: "Max 5000 characters" },
            validate: (v) => (v.trim() ? true : "Post cannot be blank"),
          })}
          placeholder="Share an update..."
        />
      </Field>
      <Button type="submit" loading={isSubmitting} colorPalette="blue">
        Post
      </Button>
    </form>
  );
}
