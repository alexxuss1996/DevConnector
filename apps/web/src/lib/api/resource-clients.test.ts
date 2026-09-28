import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthApiClient } from "@/lib/api/auth";
import { PostsApiClient } from "@/lib/api/posts";
import { ProfileApiClient } from "@/lib/api/profile";

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
      "http://api.test/profiles/?page=2&limit=10",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://api.test/profiles/experience/experience-id",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("reads a single public profile by owner id", async () => {
    const fetchMock = mockOkResponse();
    vi.stubGlobal("fetch", fetchMock);
    const client = new ProfileApiClient(baseUrl);

    await client.getProfileById({ id: "65f0f0f0f0f0f0f0f0f0f0f" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/profiles/user/65f0f0f0f0f0f0f0f0f0f0f",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("creates with POST and updates with PATCH", async () => {
    const fetchMock = mockOkResponse();
    vi.stubGlobal("fetch", fetchMock);
    const client = new ProfileApiClient(baseUrl);

    await client.createProfile({ status: "Developer", skills: ["JS"] });
    await client.updateProfile({ status: "Senior" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://api.test/profiles/",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ status: "Developer", skills: ["JS"] }) }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://api.test/profiles/",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "Senior" }) }),
    );
  });

  it("surfaces the list envelope the API returns", async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response(
        JSON.stringify({ profiles: [{ _id: "p1" }], total: 1, page: 1, limit: 12 }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new ProfileApiClient(baseUrl);

    const result = await client.getProfiles({ page: 1, limit: 12 });

    expect(result.total).toBe(1);
    expect(result.profiles).toHaveLength(1);
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
