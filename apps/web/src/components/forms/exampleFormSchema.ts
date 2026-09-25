import { z } from "zod";

export const exampleFormSchema = z.object({
  name: z.string().min(2, "Name needs at least 2 characters."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password needs at least 8 characters."),
  age: z.coerce.number().int().min(13, "Must be 13 or older."),
  bio: z.string().max(280, "Bio must be 280 characters or less.").optional(),
  role: z.enum(["frontend", "backend", "fullstack"], {
    message: "Pick a role.",
  }),
  gender: z.enum(["she", "he", "they"], { message: "Pick an option." }),
  birthdate: z.string().min(1, "Pick a birthdate."),
  notify: z.boolean(),
  terms: z.literal(true, {
    message: "You must accept the terms.",
  }),
  tags: z.array(z.string()).min(1, "Add at least one tag."),
});

export type ExampleFormValues = z.output<typeof exampleFormSchema>;
export type ExampleFormInput = z.input<typeof exampleFormSchema>;
