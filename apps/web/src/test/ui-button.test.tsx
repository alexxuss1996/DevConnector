// @vitest-environment jsdom
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import { Button } from "@/components/ui/button";

/**
 * This test exists to prove the component-test harness works. Before it, the
 * Vitest `include` glob matched only `*.test.ts` and `environment` was `node`,
 * so a `.tsx` test was silently ignored rather than reported as a failure — the
 * suite went green while skipping everything it could not run.
 */
async function render(node: React.ReactNode) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;

  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<ChakraProvider value={defaultSystem}>{node}</ChakraProvider>);
  });

  return { container, root };
}

test("renders a Chakra button into the document", async () => {
  const { container, root } = await render(<Button>Save profile</Button>);

  const button = container.querySelector("button");
  expect(button).not.toBeNull();
  expect(button?.textContent).toBe("Save profile");

  await act(async () => {
    root.unmount();
  });
  container.remove();
});
