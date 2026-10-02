// @vitest-environment jsdom
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const navMocks = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navMocks.replace }),
  usePathname: () => "/posts",
  useSearchParams: () => new URLSearchParams(""),
}));

import { isUnauthorizedError, loginHref, useUnauthorizedRedirect } from "@/lib/auth-redirect";

describe("loginHref", () => {
  it("builds a login URL preserving next", () => {
    expect(loginHref("/posts")).toBe("/login?next=%2Fposts");
    expect(loginHref("/posts?postId=6712abcd1234abcd1234abcd")).toBe(
      "/login?next=%2Fposts%3FpostId%3D6712abcd1234abcd1234abcd",
    );
  });
});

describe("isUnauthorizedError", () => {
  it("matches only 401 ApiErrors", () => {
    expect(isUnauthorizedError(new ApiError(401, "UNAUTHORIZED", "Unauthorized"))).toBe(true);
    expect(isUnauthorizedError(new ApiError(500, "INTERNAL_ERROR", "Boom"))).toBe(false);
    expect(isUnauthorizedError(new Error("network down"))).toBe(false);
  });
});

describe("useUnauthorizedRedirect", () => {
  function Probe({ err, onResult }: { err: unknown; onResult: (v: boolean) => void }) {
    const redirect = useUnauthorizedRedirect();
    return <button type="button" onClick={() => onResult(redirect(err))} />;
  }

  async function render(node: React.ReactNode) {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<ChakraProvider value={defaultSystem}>{node}</ChakraProvider>);
    });
    return { container, root };
  }

  it("redirects to login preserving next on 401", async () => {
    const onResult = vi.fn();
    const { container, root } = await render(
      <Probe err={new ApiError(401, "UNAUTHORIZED", "Unauthorized")} onResult={onResult} />,
    );

    await act(async () => {
      container.querySelector("button")?.click();
    });

    expect(onResult).toHaveBeenCalledWith(true);
    expect(navMocks.replace).toHaveBeenCalledWith("/login?next=%2Fposts");

    await act(async () => root.unmount());
    container.remove();
  });

  it("declines non-401 errors without redirecting", async () => {
    const onResult = vi.fn();
    const { container, root } = await render(
      <Probe err={new ApiError(500, "INTERNAL_ERROR", "Boom")} onResult={onResult} />,
    );

    await act(async () => {
      container.querySelector("button")?.click();
    });

    expect(onResult).toHaveBeenCalledWith(false);
    expect(navMocks.replace).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    container.remove();
  });
});
