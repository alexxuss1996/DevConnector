"use client";

import { Input, Textarea } from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Field } from "../ui/field";
import { NativeSelectField, NativeSelectRoot } from "../ui/native-select";
import { NumberInputField, NumberInputRoot } from "../ui/number-input";
import { PasswordInput } from "../ui/password-input";
import { Radio, RadioGroup } from "../ui/radio";
import { Switch } from "../ui/switch";
import { TagsInputControl, TagsInputRoot } from "../ui/tags-input";
import {
  ExampleFormInput,
  ExampleFormValues,
  exampleFormSchema,
} from "./exampleFormSchema";

export function ExampleForm({
  onSubmit,
}: {
  onSubmit: (values: ExampleFormValues) => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ExampleFormInput, unknown, ExampleFormValues>({
    resolver: zodResolver(exampleFormSchema),
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
          <NumberInputField {...register("age")} />
        </NumberInputRoot>
      </Field>
      <Field label="Bio" helperText="Up to 280 characters.">
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
