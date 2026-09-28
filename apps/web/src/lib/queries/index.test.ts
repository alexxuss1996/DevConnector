import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mutationOptions: undefined as { onSuccess?: (...args: unknown[]) => unknown } | undefined,
  queryOptions: undefined as Record<string, unknown> | undefined,
  useMutation: vi.fn((options: typeof mocks.mutationOptions) => {
    mocks.mutationOptions = options;
    return options;
  }),
  useQuery: vi.fn((options: Record<string, unknown>) => {
    mocks.queryOptions = options;
    return options;
  }),
  useQueryClient: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: mocks.useMutation,
  useQuery: mocks.useQuery,
  useQueryClient: mocks.useQueryClient,
}));

import {
  useAddCommentMutation,
  useCreateProfileMutation,
  useLogoutMutation,
  useProfileById,
  useProfiles,
} from "@/lib/queries/index";

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

describe("public profile queries", () => {
  beforeEach(() => {
    mocks.queryOptions = undefined;
  });

  it("keys the profile list by page so each page caches separately", () => {
    useProfiles({ page: 3, limit: 12 });

    expect(mocks.queryOptions?.queryKey).toEqual(["profiles", { page: 3, limit: 12 }]);
  });

  it("forwards caller options such as keeping the previous page visible", () => {
    useProfiles({ page: 1, limit: 12 }, { enabled: true });

    expect(mocks.queryOptions?.enabled).toBe(true);
  });

  it("can disable the single-profile query before an id is known", () => {
    useProfileById({ id: "" }, { enabled: false });

    expect(mocks.queryOptions?.enabled).toBe(false);
    expect(mocks.queryOptions?.queryKey).toEqual(["profile", ""]);
  });
});
