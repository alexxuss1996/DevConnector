"use client";

import { Input, Textarea } from "@chakra-ui/react";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { NativeSelectField, NativeSelectRoot } from "@/components/ui/native-select";
import { NumberInputField, NumberInputRoot } from "@/components/ui/number-input";
import { PasswordInput } from "@/components/ui/password-input";
import { Radio, RadioGroup } from "@/components/ui/radio";
import { Switch } from "@/components/ui/switch";
import { TagsInputControl, TagsInputRoot } from "@/components/ui/tags-input";
import type { ExampleFormValues } from "@/components/forms/exampleFormSchema";
import { exampleFormResolver } from "@/components/forms/exampleFormResolver";

export interface ExampleFormProps {
  onSubmit: (values: ExampleFormValues) => void;
}

export function ExampleForm({ onSubmit }: ExampleFormProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ExampleFormValues>({
    resolver: exampleFormResolver,
    defaultValues: {
      name: "",
      email: "",
      password: "",
      bio: "",
      role: "frontend",
      notify: true,
      tags: ["react"],
    },
  });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      style={{ display: "grid", gap: 16, maxWidth: 480 }}
    >
      <Field label="Name" invalid={!!errors.name} errorText={errors.name?.message}>
        <Input {...register("name")} placeholder="Alex" />
      </Field>
      <Field
        label="Email"
        invalid={!!errors.email}
        errorText={errors.email?.message}
      >
        <Input {...register("email")} placeholder="you@example.com" />
      </Field>
      <Field
        label="Password"
        invalid={!!errors.password}
        errorText={errors.password?.message}
      >
        <PasswordInput {...register("password")} />
      </Field>
      <Field label="Age" invalid={!!errors.age} errorText={errors.age?.message}>
        <NumberInputRoot>
          <NumberInputField {...register("age", { valueAsNumber: true })} />
        </NumberInputRoot>
      </Field>
      <Field
        label="Bio"
        helperText="Up to 280 characters."
        invalid={!!errors.bio}
        errorText={errors.bio?.message}
      >
        <Textarea {...register("bio")} placeholder="I build things." />
      </Field>
      <Field
        label="Role"
        invalid={!!errors.role}
        errorText={errors.role?.message}
      >
        <NativeSelectRoot>
          <NativeSelectField {...register("role")}>
            <option value="frontend">Frontend</option>
            <option value="backend">Backend</option>
            <option value="fullstack">Fullstack</option>
          </NativeSelectField>
        </NativeSelectRoot>
      </Field>
      <Field
        label="Gender"
        invalid={!!errors.gender}
        errorText={errors.gender?.message}
      >
        <Controller
          name="gender"
          control={control}
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={(details) =>
                field.onChange(
                  (details.value ?? "") as ExampleFormValues["gender"],
                )
              }
              name={field.name}
            >
              <Radio value="she">She</Radio>
              <Radio value="he">He</Radio>
              <Radio value="they">They</Radio>
            </RadioGroup>
          )}
        />
      </Field>
      <Field
        label="Birthdate"
        invalid={!!errors.birthdate}
        errorText={errors.birthdate?.message}
      >
        <Input type="date" {...register("birthdate")} />
      </Field>
      <Controller
        name="notify"
        control={control}
        render={({ field }) => (
          <Switch
            checked={field.value}
            onCheckedChange={(details) => field.onChange(details.checked)}
          >
            Email notifications
          </Switch>
        )}
      />
      <Controller
        name="terms"
        control={control}
        render={({ field }) => (
          <Checkbox
            checked={field.value === true}
            onCheckedChange={(details) => field.onChange(details.checked)}
          >
            I accept the terms
          </Checkbox>
        )}
      />
      {errors.terms && <p style={{ color: "red" }}>{errors.terms.message}</p>}
      <Field
        label="Tags"
        invalid={!!errors.tags}
        errorText={errors.tags?.message}
      >
        <Controller
          name="tags"
          control={control}
          render={({ field }) => (
            <TagsInputRoot
              value={field.value}
              onValueChange={(details) => field.onChange(details.value)}
            >
              <TagsInputControl clearable />
            </TagsInputRoot>
          )}
        />
      </Field>
      <Button type="submit" loading={isSubmitting} colorPalette="blue">
        Create profile
      </Button>
    </form>
  );
}
