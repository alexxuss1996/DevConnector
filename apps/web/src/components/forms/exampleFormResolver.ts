import { typeboxResolver } from "@hookform/resolvers/typebox";
import type { Resolver } from "react-hook-form";
import {
  type ExampleFormValues,
  exampleFormSchema,
} from "@/components/forms/exampleFormSchema";

/**
 * Human copy for the constraint messages. TypeBox's own wording is accurate but
 * developer-facing — "Expected true" instead of "You must accept the terms." —
 * so the resolver's messages are replaced here. Kept as the single source for
 * that copy; the `errorMessage` keywords in the schema are not read by TypeBox.
 */
const FIELD_MESSAGES: Record<string, string> = {
  name: "Name needs at least 2 characters.",
  email: "Enter a valid email address.",
  password: "Password needs at least 8 characters.",
  age: "Must be 13 or older.",
  bio: "Bio must be 280 characters or less.",
  role: "Pick a role.",
  gender: "Pick an option.",
  birthdate: "Pick a birthdate.",
  terms: "You must accept the terms.",
  tags: "Add at least one tag.",
};

const resolve = typeboxResolver(exampleFormSchema);

/**
 * `@hookform/resolvers/typebox` maps TypeBox errors onto react-hook-form's shape
 * and is the reason the schema is pinned to `@sinclair/typebox` 0.x. The only
 * thing added here is the friendly message copy.
 */
export const exampleFormResolver: Resolver<ExampleFormValues> = async (
  values,
  context,
  options,
) => {
  const result = await resolve(values, context, options);

  for (const [field, error] of Object.entries(result.errors ?? {})) {
    const message = FIELD_MESSAGES[field];
    if (message && error) error.message = message;
  }

  return result;
};
