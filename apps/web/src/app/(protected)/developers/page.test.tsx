// @vitest-environment jsdom
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profiles: undefined as unknown,
  page: 1,
  setPage: vi.fn(),
  userId: "",
  setUserId: vi.fn(),
}));

vi.mock("@/lib/queries", () => ({
  useProfiles: () => mocks.profiles,
}));

vi.mock("nuqs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("nuqs")>();
  return {
    ...actual,
    useQueryState: (key: string) =>
      key === "page" ? [mocks.page, mocks.setPage] : [mocks.userId, mocks.setUserId],
  };
});

vi.mock("@/components/developers/ProfileDetailDialog", () => ({
  ProfileDetailDialog: () => null,
}));

import DevelopersPage from "@/app/(protected)/developers/page";

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
  mocks.profiles = { data: undefined, isLoading: true };
});

describe("DevelopersPage empty", () => {
  it("hides pagination and shows EmptyState when total is 0", async () => {
    mocks.profiles = {
      data: { profiles: [], total: 0, page: 1, limit: 12 },
      isLoading: false,
    };

    const { container, root } = await render(<DevelopersPage />);

    expect(container.textContent).toMatch(/no developers/i);
    expect(container.querySelector('[data-testid="pagination"]')).toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });
});
