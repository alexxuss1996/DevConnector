import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClient, ApiError, toQuery } from "@/lib/api/client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ApiClient", () => {
  it("sends JSON with cookies and parses a successful response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ profile: { _id: "profile-id" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new ApiClient("http://api.test").request<{
      profile: { _id: string };
    }>("/profiles/me");

    expect(result.profile._id).toBe("profile-id");
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/profiles/me", {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
  });

  it("returns undefined for an empty 204 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(new ApiClient("http://api.test").request("/auth/logout")).resolves.toBeUndefined();
  });

  it("throws the backend error code and message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: "INVALID_CREDENTIALS", message: "Invalid login" }), {
          status: 401,
        }),
      ),
    );

    await expect(
      new ApiClient("http://api.test").request("/auth/login"),
    ).rejects.toEqual(
      expect.objectContaining<ApiError>({
        name: "ApiError",
        status: 401,
        code: "INVALID_CREDENTIALS",
        message: "Invalid login",
      }),
    );
  });
  it("keeps the HTTP status when the error body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html><body>Not Found</body></html>", {
          status: 404,
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    await expect(
      new ApiClient("http://api.test").request("/profiles/"),
    ).rejects.toEqual(
      expect.objectContaining<ApiError>({
        name: "ApiError",
        status: 404,
        code: "REQUEST_FAILED",
        message: "Request failed: 404",
      }),
    );
  });
});

describe("toQuery", () => {
  it("omits unset values and preserves zero", () => {
    expect(toQuery({})).toBe("");
    expect(toQuery({ page: 0, limit: 20 })).toBe("?page=0&limit=20");
  });
});
