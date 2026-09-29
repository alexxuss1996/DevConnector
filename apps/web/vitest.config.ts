import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig sets `jsx: "preserve"` because Next.js does its own transform.
  // Vite would otherwise hand the untouched JSX to the runtime and fail to
  // parse it, so compile it here with the automatic runtime instead.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // Component tests opt into a DOM per file with a `@vitest-environment
    // jsdom` docblock, so the rest of the suite keeps the faster node
    // environment. `environmentMatchGlobs` was removed in Vitest 5; the
    // docblock is the supported replacement.
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    restoreMocks: true,
  },
});
