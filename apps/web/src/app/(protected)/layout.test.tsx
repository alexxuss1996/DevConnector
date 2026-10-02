// @vitest-environment jsdom
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  myProfile: undefined as unknown,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => "/posts",
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/lib/queries", () => ({
  useMyProfile: () => mocks.myProfile,
}));

import ProtectedLayout from "@/app/(protected)/layout";

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

beforeEach(() => {
  mocks.replace.mockClear();
});

describe("ProtectedLayout", () => {
  it("redirects to login with next on 401", async () => {
    mocks.myProfile = {
      isLoading: false,
      error: new ApiError(401, "UNAUTHORIZED", "Unauthorized"),
    };

    const { container, root } = await render(
      <ProtectedLayout>
        <div data-testid="protected-children">secret</div>
      </ProtectedLayout>,
    );

    expect(mocks.replace).toHaveBeenCalledOnce();
    const firstCall = mocks.replace.mock.calls[0];
    expect(firstCall?.[0]).toMatch(/^\/login\?next=/);
    expect(container.querySelector('[data-testid="protected-children"]')).toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });

  it("renders children on success", async () => {
    mocks.myProfile = {
      isLoading: false,
      data: { profile: { _id: "p1", userId: { _id: "u1" } } },
    };

    const { container, root } = await render(
      <ProtectedLayout>
        <div data-testid="protected-children">secret</div>
      </ProtectedLayout>,
    );

    expect(mocks.replace).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="protected-children"]')?.textContent).toBe(
      "secret",
    );

    await act(async () => root.unmount());
    container.remove();
  });

  it("redirects to create-profile when the user has no profile", async () => {
    mocks.myProfile = {
      isLoading: false,
      error: new ApiError(404, "PROFILE_NOT_FOUND", "Profile not found"),
    };

    const { container, root } = await render(
      <ProtectedLayout>
        <div data-testid="protected-children">secret</div>
      </ProtectedLayout>,
    );

    expect(mocks.replace).toHaveBeenCalledOnce();
    const firstCall = mocks.replace.mock.calls[0];
    expect(firstCall?.[0]).toMatch(/^\/create-profile\?next=/);
    expect(container.querySelector('[data-testid="protected-children"]')).toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });

  it("shows an error state instead of a blank page on non-401 errors", async () => {
    mocks.myProfile = {
      isLoading: false,
      error: new ApiError(500, "INTERNAL_ERROR", "Boom"),
    };

    const { container, root } = await render(
      <ProtectedLayout>
        <div data-testid="protected-children">secret</div>
      </ProtectedLayout>,
    );

    expect(mocks.replace).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="protected-children"]')).toBeNull();
    expect(container.textContent).toMatch(/something went wrong/i);

    await act(async () => root.unmount());
    container.remove();
  });
});
