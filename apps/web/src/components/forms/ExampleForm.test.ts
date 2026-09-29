import { Value } from "@sinclair/typebox/value";
import { describe, expect, test } from "vitest";
import { exampleFormSchema } from "@/components/forms/exampleFormSchema";
import { exampleFormResolver } from "@/components/forms/exampleFormResolver";

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

// Resolver options. `shouldUseNativeValidation: false` keeps it on its own
// validation path instead of deferring to the browser's constraint validation.
const options = {
  criteriaMode: "firstError",
  shouldUseNativeValidation: false,
} as const;

// react-hook-form calls a resolver with the raw form values, which are partial
// and unvalidated until the resolver itself says otherwise, and its
// `ResolverOptions` demands a full `fields` record. Neither is modelled by the
// types we are calling through, so both casts are confined here rather than
// repeated at every call site.
const runResolver = (values: unknown) =>
  exampleFormResolver(values as never, {} as never, options as never);

function errorPaths(value: unknown): string[] {
  // TypeBox 0.34 reports one error per failing property, each with its own
  // `path`, and `Value.Errors` returns an iterator rather than an array.
  return [...Value.Errors(exampleFormSchema, value)].map((e) => e.path);
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

describe("exampleFormResolver", () => {
  test("returns the values unchanged when everything is valid", async () => {
    const result = await runResolver(valid);
    expect(result.errors).toEqual({});
    expect(result.values).toEqual(valid);
  });

  test("keys errors by field name and uses the friendly copy", async () => {
    const result = await runResolver({ ...valid, name: "A", email: "nope", age: 10 });

    expect(Object.keys(result.errors ?? {}).sort()).toEqual([
      "age",
      "email",
      "name",
    ]);
    expect(result.errors?.name?.message).toBe("Name needs at least 2 characters.");
    expect(result.errors?.email?.message).toBe("Enter a valid email address.");
    expect(result.errors?.age?.message).toBe("Must be 13 or older.");
  });

  test("reports every missing required field, each with its own key", async () => {
    // The previous hand-rolled resolver fanned a single root error out by
    // reading `params.requiredProperties`, which TypeBox 0.34 does not provide.
    // `notify` has no entry in the friendly-message map, and must still appear.
    const result = await runResolver({});

    expect(Object.keys(result.errors ?? {}).sort()).toEqual([
      "age",
      "birthdate",
      "email",
      "gender",
      "name",
      "notify",
      "password",
      "role",
      "tags",
      "terms",
    ]);
    expect(result.errors?.terms?.message).toBe("You must accept the terms.");
  });

  test("does not silently drop a field that has no friendly message", async () => {
    // The old resolver only recorded an error when the field name appeared in
    // its FIELD_MESSAGES map, so any constraint without an entry submitted
    // silently. Every failing field must surface, mapped or not.
    const { gender, ...rest } = valid;
    const result = await runResolver({ ...rest, role: "designer" });

    expect(result.errors?.role).toBeDefined();
    expect(Object.keys(result.errors ?? {})).toContain("role");
  });

  test("withholds values when validation fails", async () => {
    const result = await runResolver({ ...valid, name: "A" });
    expect(result.values).toEqual({});
  });
});
