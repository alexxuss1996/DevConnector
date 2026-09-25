import { describe, expect, test } from "vitest";
import { exampleFormSchema } from "./exampleFormSchema";

const valid = {
  name: "Alex",
  email: "alex@example.com",
  password: "s3cret!!",
  age: 30,
  bio: "I build things.",
  role: "frontend",
  gender: "she",
  birthdate: "1990-01-01",
  notify: true,
  terms: true,
  tags: ["react"],
};

describe("exampleFormSchema", () => {
  test("accepts valid values", () => {
    expect(exampleFormSchema.safeParse(valid).success).toBe(true);
  });

  test("rejects empty submit with errors for every required field", () => {
    const result = exampleFormSchema.safeParse({});
    expect(result.success).toBe(false);
    if (result.success) return;
    const keys = Object.keys(result.error.flatten().fieldErrors);
    for (const key of [
      "name",
      "email",
      "password",
      "age",
      "role",
      "gender",
      "birthdate",
      "terms",
      "tags",
    ]) {
      expect(keys).toContain(key);
    }
  });

  test("rejects bad email, short password, underage", () => {
    const result = exampleFormSchema.safeParse({
      ...valid,
      email: "nope",
      password: "short",
      age: 10,
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const fields = result.error.flatten().fieldErrors;
    expect(fields.email).toBeDefined();
    expect(fields.password).toBeDefined();
    expect(fields.age).toBeDefined();
  });

  test("rejects missing terms acceptance and empty tags", () => {
    const result = exampleFormSchema.safeParse({
      ...valid,
      terms: false,
      tags: [],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const fields = result.error.flatten().fieldErrors;
    expect(fields.terms).toBeDefined();
    expect(fields.tags).toBeDefined();
  });
});
