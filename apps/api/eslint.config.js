import { config as baseConfig } from "@dev-conn/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  { ignores: ["dist/**"] },
  ...baseConfig,
  {
    rules: {
      // Deliberate: Fastify/Mongoose escape hatches and test stubs lean on
      // `any` throughout. Tightening this needs a real pass over the stubs.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
