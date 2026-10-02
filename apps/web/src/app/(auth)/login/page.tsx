"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { useForm } from "react-hook-form";
import { Input } from "@chakra-ui/react";
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
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: "grid", gap: 16, maxWidth: 400 }}>
      <Field label="Email" invalid={!!errors.email} errorText={errors.email?.message}>
        <Input type="email" {...register("email", { required: "Email is required" })} placeholder="you@example.com" />
      </Field>
      <Field label="Password" invalid={!!errors.password} errorText={errors.password?.message}>
        <PasswordInput {...register("password", { required: "Password is required" })} />
      </Field>
      <Button type="submit" loading={isSubmitting} colorPalette="blue">
        Log in
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
