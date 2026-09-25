import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mutationOptions: undefined as { onSuccess?: (...args: unknown[]) => unknown } | undefined,
  useMutation: vi.fn((options: typeof mocks.mutationOptions) => {
    mocks.mutationOptions = options;
    return options;
  }),
  useQueryClient: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: mocks.useMutation,
  useQueryClient: mocks.useQueryClient,
}));

import {
  useAddCommentMutation,
  useCreateProfileMutation,
  useLogoutMutation,
} from "./index";

function runOnSuccess(...args: unknown[]) {
  mocks.mutationOptions?.onSuccess?.(...args);
}

describe("query cache invalidation", () => {
  const clear = vi.fn();
  const invalidateQueries = vi.fn();

  beforeEach(() => {
    mocks.mutationOptions = undefined;
    clear.mockClear();
    invalidateQueries.mockClear();
    mocks.useQueryClient.mockReturnValue({ clear, invalidateQueries });
  });

  it("clears cached data after logout", () => {
    useLogoutMutation();
    runOnSuccess(undefined, undefined, undefined);

    expect(clear).toHaveBeenCalledOnce();
  });

  it("invalidates profile lists after a profile mutation", () => {
    useCreateProfileMutation();
    runOnSuccess(undefined, undefined, undefined);

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["profile"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["profiles"] });
  });

  it("invalidates the affected post after adding a comment", () => {
    const postId = "post-id";
    useAddCommentMutation();
    runOnSuccess(undefined, { params: { id: postId }, data: { text: "Nice" } }, undefined);

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["post", postId] });
  });
});
