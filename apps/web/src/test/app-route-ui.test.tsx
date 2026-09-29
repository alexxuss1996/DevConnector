// @vitest-environment jsdom
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import RouteError from "@/app/error";
import Loading from "@/app/loading";
import { ApiError } from "@/lib/api/client";

// Same harness as `ui-button.test.tsx`: a Chakra component needs
// `ChakraProvider`, and `IS_REACT_ACT_ENVIRONMENT` is what lets `act` flush.
async function render(node: ReactNode) {
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

test("loading renders a status region, not an error", async () => {
  const { container, root } = await render(<Loading />);

  expect(container.querySelector('[role="status"]')).not.toBeNull();
  expect(container.textContent ?? "").not.toMatch(/error|failed/i);

  await act(async () => root.unmount());
  container.remove();
});

test("error boundary surfaces an ApiError request id and retries on click", async () => {
  // The boundary logs the error itself; keep that out of the test output.
  vi.spyOn(console, "error").mockImplementation(() => {});
  const retry = vi.fn();

  const { container, root } = await render(
    <RouteError
      error={new ApiError(500, "INTERNAL_ERROR", "Request failed: 500", "req_abc123")}
      retry={retry}
    />,
  );

  expect(container.textContent).toContain("Request failed: 500");
  expect(container.textContent).toContain("req_abc123");
  // A stack trace is for the console, not the user.
  expect(container.textContent ?? "").not.toContain("at ");

  const button = container.querySelector("button");
  expect(button?.textContent).toBe("Try again");

  await act(async () => button?.click());
  expect(retry).toHaveBeenCalledTimes(1);

  await act(async () => root.unmount());
  container.remove();
});

test("error boundary falls back to the digest for a non-API error", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});

  const { container, root } = await render(
    <RouteError error={Object.assign(new Error("boom"), { digest: "d1g" })} retry={vi.fn()} />,
  );

  expect(container.textContent).toContain("d1g");
  expect(container.textContent).not.toContain("undefined");

  await act(async () => root.unmount());
  container.remove();
});
