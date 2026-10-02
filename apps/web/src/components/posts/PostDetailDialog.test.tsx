// @vitest-environment jsdom
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const POST_ID = "6712abcd1234abcd1234abcd";

const mocks = vi.hoisted(() => ({
  usePost: vi.fn(),
  usePostComments: vi.fn(),
  addComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
  myId: "6712abcd1234abcd1234abce",
}));

vi.mock("@/lib/queries", () => ({
  usePost: (...args: unknown[]) => mocks.usePost(...args),
  usePostComments: (...args: unknown[]) => mocks.usePostComments(...args),
  useAddCommentMutation: () => ({ mutateAsync: mocks.addComment }),
  useUpdateCommentMutation: () => ({ mutateAsync: mocks.updateComment }),
  useDeleteCommentMutation: () => ({ mutateAsync: mocks.deleteComment }),
  useMyProfile: () => ({ data: { profile: { userId: { _id: mocks.myId } } } }),
}));

import { PostDetailDialog } from "@/components/posts/PostDetailDialog";

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

function fillTextarea(el: HTMLTextAreaElement | null, value: string) {
  if (!el) throw new Error("textarea missing");
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.usePost.mockReturnValue({ data: undefined, isLoading: true, error: null });
  mocks.usePostComments.mockReturnValue({ data: undefined, isLoading: true, error: null });
  mocks.addComment.mockResolvedValue([]);
});

describe("PostDetailDialog", () => {
  it("shows EmptyState for non-ObjectId postId with fetching disabled", async () => {
    const { container, root } = await render(
      <PostDetailDialog postId="not-an-id" onClose={() => {}} />,
    );

    expect(document.body.textContent).toMatch(/not found|invalid/i);
    expect(mocks.usePost).toHaveBeenCalledWith({ id: "not-an-id" }, { enabled: false });

    await act(async () => root.unmount());
    container.remove();
  });

  it("adds a comment via useAddCommentMutation", async () => {
    mocks.usePost.mockReturnValue({
      data: {
        post: {
          _id: POST_ID,
          userId: { _id: "other", name: "Alex" },
          text: "Hi",
          likes: [],
          comments: [],
        },
      },
      isLoading: false,
      error: null,
    });
    mocks.usePostComments.mockReturnValue({
      data: {
        comments: [
          { _id: "6723abcd1234abcd1234abcd", userId: "6712abcd1234abcd1234abce", text: "Nice", name: "Sam" },
        ],
      },
      isLoading: false,
      error: null,
    });

    const { container, root } = await render(
      <PostDetailDialog postId={POST_ID} onClose={() => {}} />,
    );

    expect(document.body.textContent).toContain("Nice");

    const textarea = document.body.querySelector("textarea");
    await act(async () => {
      fillTextarea(textarea, "Great post");
    });
    const submit = document.body.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    await act(async () => {
      submit?.click();
    });

    expect(mocks.addComment).toHaveBeenCalledWith({
      params: { id: POST_ID },
      data: { text: "Great post" },
    });

    await act(async () => root.unmount());
    container.remove();
  });

  it("blocks blank comment submit without API call", async () => {
    mocks.usePost.mockReturnValue({
      data: {
        post: {
          _id: POST_ID,
          userId: { _id: "other", name: "Alex" },
          text: "Hi",
          likes: [],
          comments: [],
        },
      },
      isLoading: false,
      error: null,
    });
    mocks.usePostComments.mockReturnValue({
      data: { comments: [] },
      isLoading: false,
      error: null,
    });

    const { container, root } = await render(
      <PostDetailDialog postId={POST_ID} onClose={() => {}} />,
    );

    const textarea = document.body.querySelector("textarea");
    await act(async () => {
      fillTextarea(textarea, "   ");
    });
    const submit = document.body.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    await act(async () => {
      submit?.click();
    });

    expect(mocks.addComment).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    container.remove();
  });

  it("shows EmptyState on 404", async () => {
    mocks.usePost.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new ApiError(404, "POST_NOT_FOUND", "Not found"),
    });

    const { container, root } = await render(
      <PostDetailDialog postId={POST_ID} onClose={() => {}} />,
    );

    expect(document.body.textContent).toMatch(/not found/i);

    await act(async () => root.unmount());
    container.remove();
  });
});
