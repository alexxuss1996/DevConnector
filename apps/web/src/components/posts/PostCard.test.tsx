// @vitest-environment jsdom
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { Post } from "@dev-conn/contracts";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  like: vi.fn(),
  unlike: vi.fn(),
  remove: vi.fn(),
  replace: vi.fn(),
  myId: "6712abcd1234abcd1234abce",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => "/posts",
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/lib/queries", () => ({
  useLikePostMutation: () => ({ mutateAsync: mocks.like }),
  useUnlikePostMutation: () => ({ mutateAsync: mocks.unlike }),
  useDeletePostMutation: () => ({ mutateAsync: mocks.remove }),
  useMyProfile: () => ({ data: { profile: { userId: { _id: mocks.myId } } } }),
}));

import { PostCard } from "@/components/posts/PostCard";
import { ApiError } from "@/lib/api/client";

const basePost: Post = {
  _id: "6712abcd1234abcd1234abcd",
  userId: { _id: "6712abcd1234abcd1234abce", name: "Alex" },
  text: "Hi",
  likes: [],
  comments: [],
};

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
  mocks.like.mockClear();
  mocks.unlike.mockClear();
  mocks.remove.mockClear();
  mocks.like.mockResolvedValue(undefined);
  mocks.unlike.mockResolvedValue(undefined);
  mocks.remove.mockResolvedValue(undefined);
});

describe("PostCard", () => {
  it("likes an unliked post via likePost", async () => {
    const onOpen = vi.fn();
    const { container, root } = await render(<PostCard post={basePost} onOpen={onOpen} />);

    const likeButton = container.querySelector('[data-testid="like-button"]') as HTMLButtonElement | null;
    expect(likeButton).not.toBeNull();
    await act(async () => {
      likeButton?.click();
    });

    expect(mocks.like).toHaveBeenCalledWith({ id: basePost._id });
    expect(mocks.unlike).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    container.remove();
  });

  it("unlikes a liked post via unlikePost", async () => {
    const onOpen = vi.fn();
    const liked: Post = { ...basePost, likes: [{ userId: mocks.myId }] };
    const { container, root } = await render(<PostCard post={liked} onOpen={onOpen} />);

    const likeButton = container.querySelector('[data-testid="like-button"]') as HTMLButtonElement | null;
    await act(async () => {
      likeButton?.click();
    });

    expect(mocks.unlike).toHaveBeenCalledWith({ id: basePost._id });
    expect(mocks.like).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    container.remove();
  });

  it("opens detail on click", async () => {
    const onOpen = vi.fn();
    const { container, root } = await render(<PostCard post={basePost} onOpen={onOpen} />);

    const title = container.querySelector('[data-testid="post-open"]') as HTMLElement | null;
    expect(title).not.toBeNull();
    await act(async () => {
      title?.click();
    });

    expect(onOpen).toHaveBeenCalledWith(basePost._id);

    await act(async () => root.unmount());
    container.remove();
  });

  it("redirects to login when like fails with 401", async () => {
    mocks.like.mockRejectedValueOnce(new ApiError(401, "UNAUTHORIZED", "Unauthorized"));
    const { container, root } = await render(<PostCard post={basePost} onOpen={vi.fn()} />);

    await act(async () => {
      (container.querySelector('[data-testid="like-button"]') as HTMLButtonElement)?.click();
    });

    expect(mocks.replace).toHaveBeenCalledWith("/login?next=%2Fposts");

    await act(async () => root.unmount());
    container.remove();
  });
});
