// @vitest-environment jsdom
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const mocks = vi.hoisted(() => ({
  posts: undefined as unknown,
  postId: "",
  setPostId: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/posts",
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/lib/queries", () => ({
  usePosts: () => mocks.posts,
  useCreatePostMutation: () => ({ mutateAsync: vi.fn() }),
  useLikePostMutation: () => ({ mutateAsync: vi.fn() }),
  useUnlikePostMutation: () => ({ mutateAsync: vi.fn() }),
  useDeletePostMutation: () => ({ mutateAsync: vi.fn() }),
  useMyProfile: () => ({ data: undefined }),
}));

vi.mock("nuqs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("nuqs")>();
  return {
    ...actual,
    useQueryState: () => [mocks.postId, mocks.setPostId],
  };
});

vi.mock("@/components/posts/PostDetailDialog", () => ({
  PostDetailDialog: () => null,
}));

import PostsPage from "@/app/(protected)/posts/page";

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
  mocks.posts = { data: undefined, isLoading: true, error: null };
});

describe("PostsPage", () => {
  it("keeps the feed in one constrained column", async () => {
    mocks.posts = { data: undefined, isLoading: true, error: null };

    const { container, root } = await render(<PostsPage />);

    const column = container.querySelector('[data-testid="feed-column"]');
    expect(column).not.toBeNull();
    expect(column?.querySelector("h1")?.textContent).toBe("Posts");

    await act(async () => root.unmount());
    container.remove();
  });

  it("shows an error state when the list fails to load", async () => {
    mocks.posts = {
      data: undefined,
      isLoading: false,
      error: new ApiError(500, "INTERNAL_ERROR", "Boom"),
    };

    const { container, root } = await render(<PostsPage />);

    expect(container.textContent).toMatch(/something went wrong/i);

    await act(async () => root.unmount());
    container.remove();
  });
});
