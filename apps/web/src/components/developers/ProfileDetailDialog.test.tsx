// @vitest-environment jsdom
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const mocks = vi.hoisted(() => ({
  profileById: vi.fn(),
}));

vi.mock("@/lib/queries", () => ({
  useProfileById: (...args: unknown[]) => mocks.profileById(...args),
}));

import { ProfileDetailDialog } from "@/components/developers/ProfileDetailDialog";

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
  vi.clearAllMocks();
  mocks.profileById.mockReturnValue({ data: undefined, isLoading: true, error: null });
});

describe("ProfileDetailDialog", () => {
  it("shows EmptyState for invalid userId with fetching disabled", async () => {
    const { root } = await render(
      <ProfileDetailDialog userId="nope" onClose={() => {}} />,
    );

    expect(document.body.textContent).toMatch(/not found|invalid/i);
    expect(mocks.profileById).toHaveBeenCalledWith({ id: "nope" }, { enabled: false });

    await act(async () => root.unmount());
  });

  it("shows EmptyState on 404", async () => {
    mocks.profileById.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new ApiError(404, "PROFILE_NOT_FOUND", "Not found"),
    });

    const { root } = await render(
      <ProfileDetailDialog userId="6712abcd1234abcd1234abcd" onClose={() => {}} />,
    );

    expect(document.body.textContent).toMatch(/not found/i);

    await act(async () => root.unmount());
  });

  it("shows an error state on 500 instead of an empty dialog", async () => {
    mocks.profileById.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new ApiError(500, "INTERNAL_ERROR", "Boom"),
    });

    const { root } = await render(
      <ProfileDetailDialog userId="6712abcd1234abcd1234abcd" onClose={() => {}} />,
    );

    expect(document.body.textContent).toMatch(/something went wrong/i);

    await act(async () => root.unmount());
  });
});
