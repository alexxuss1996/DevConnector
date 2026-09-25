import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthApiClient } from "./auth";
import { PostsApiClient } from "./posts";
import { ProfileApiClient } from "./profile";

const baseUrl = "http://api.test";

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockOkResponse() {
  return vi.fn().mockImplementation(async () =>
    new Response(JSON.stringify({}), { status: 200 }),
  );
}

describe("resource clients", () => {
  it("sends auth requests to the expected endpoints", async () => {
    const fetchMock = mockOkResponse();
    vi.stubGlobal("fetch", fetchMock);
    const client = new AuthApiClient(baseUrl);

    await client.login({ email: "dev@example.com", password: "secret" });
    await client.logout();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://api.test/auth/login",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ email: "dev@example.com", password: "secret" }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://api.test/auth/logout",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("adds profile pagination and resource IDs", async () => {
    const fetchMock = mockOkResponse();
    vi.stubGlobal("fetch", fetchMock);
    const client = new ProfileApiClient(baseUrl);

    await client.getProfiles({ page: 2, limit: 10 });
    await client.deleteExperience({ experienceId: "experience-id" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://api.test/profile/?page=2&limit=10",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://api.test/profile/experience/experience-id",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("sends post and comment mutations with IDs", async () => {
    const fetchMock = mockOkResponse();
    vi.stubGlobal("fetch", fetchMock);
    const client = new PostsApiClient(baseUrl);

    await client.createPost({ text: "Hello" });
    await client.updateComment(
      { id: "post-id", commentId: "comment-id" },
      { text: "Updated" },
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://api.test/posts/",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ text: "Hello" }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://api.test/posts/post-id/comments/comment-id",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ text: "Updated" }) }),
    );
  });
});
