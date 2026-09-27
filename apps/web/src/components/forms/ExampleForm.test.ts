import { Value } from "typebox/value";
import { describe, expect, test } from "vitest";
import { exampleFormSchema } from "@/components/forms/exampleFormSchema";

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

function errorPaths(value: unknown): string[] {
  const paths: string[] = [];
  for (const e of Value.Errors(exampleFormSchema, value)) {
    const params = e.params as { requiredProperties?: string[] } | undefined;
    if (e.instancePath === "" && params?.requiredProperties) {
      for (const key of params.requiredProperties) paths.push(`/${key}`);
    } else {
      paths.push(e.instancePath);
    }
  }
  return paths;
}

describe("exampleFormSchema", () => {
  test("accepts valid values", () => {
    expect(Value.Check(exampleFormSchema, valid)).toBe(true);
  });

  test("rejects empty submit with errors for every required field", () => {
    expect(Value.Check(exampleFormSchema, {})).toBe(false);
    const paths = errorPaths({});
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
      expect(paths).toContain(`/${key}`);
    }
  });

  test("rejects bad email, short password, underage", () => {
    const value = { ...valid, email: "nope", password: "short", age: 10 };
    expect(Value.Check(exampleFormSchema, value)).toBe(false);
    const paths = errorPaths(value);
    expect(paths).toContain("/email");
    expect(paths).toContain("/password");
    expect(paths).toContain("/age");
  });

  test("rejects missing terms acceptance and empty tags", () => {
    const value = { ...valid, terms: false, tags: [] };
    expect(Value.Check(exampleFormSchema, value)).toBe(false);
    const paths = errorPaths(value);
    expect(paths).toContain("/terms");
    expect(paths).toContain("/tags");
  });
});
