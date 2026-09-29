import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClient, ApiError, toQuery } from "@/lib/api/client";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Headers of the nth fetch call, without asserting on call-entry existence. */
function sentHeaders(fetchMock: { mock: { calls: unknown[][] } }, nth = 0) {
  return (fetchMock.mock.calls[nth]?.[1] as RequestInit | undefined)?.headers;
}

describe("ApiClient", () => {
  it("sends cookies with the request and parses a successful response", async () => {
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
      headers: {},
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

  it("keeps Content-Type when the caller supplies its own headers", async () => {
    // `...init` used to spread after `headers`, so any caller passing
    // `init.headers` silently lost Content-Type and sent a JSON body with no
    // content type. Nothing passed `init` yet, which is why this stayed hidden.
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await new ApiClient("http://api.test").request("/posts", {
      method: "POST",
      headers: { "X-Trace": "abc" },
      body: JSON.stringify({ text: "hi" }),
    });

    expect(sentHeaders(fetchMock)).toEqual({
      "Content-Type": "application/json",
      "X-Trace": "abc",
    });
  });

  it("lets a caller override Content-Type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await new ApiClient("http://api.test").request("/posts", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "raw",
    });

    expect(sentHeaders(fetchMock)).toEqual({ "Content-Type": "text/plain" });
  });

  it("omits Content-Type on a bodyless request", async () => {
    // Cross-origin, a JSON Content-Type on a GET makes the request non-simple
    // and forces a CORS preflight for every read.
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await new ApiClient("http://api.test").request("/profiles/");

    expect(sentHeaders(fetchMock)).toEqual({});
  });

  it("throws instead of returning undefined when a 2xx body is not JSON", async () => {
    // A captive portal or gateway login page answered with 200 + HTML. Handing
    // the caller `undefined` typed as T turned that into a TypeError at the
    // render site, far from the cause.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>login</html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    await expect(
      new ApiClient("http://api.test").request("/profiles/me"),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe("ApiClient 401 handling", () => {

  it("refreshes the session and replays the original request once", async () => {
    let firstCall = true;
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/auth/refresh")) return new Response("{}", { status: 200 });
      if (firstCall) {
        firstCall = false;
        return new Response(JSON.stringify({ code: "UNAUTHORIZED" }), { status: 401 });
      }
      return new Response(JSON.stringify({ profile: { _id: "p1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await new ApiClient("http://api.test").request<{
      profile: { _id: string };
    }>("/profiles/me");

    expect(result.profile._id).toBe("p1");
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).endsWith("/auth/refresh"))).toHaveLength(1);
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).endsWith("/profiles/me"))).toHaveLength(2);
  });

  it("refreshes once for concurrent 401s, not once per request", async () => {
    let served = false;
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/auth/refresh")) {
        await new Promise((r) => setTimeout(r, 5));
        return new Response("{}", { status: 200 });
      }
      if (!served) {
        served = true;
        return new Response(JSON.stringify({ code: "UNAUTHORIZED" }), { status: 401 });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new ApiClient("http://api.test");
    await Promise.all([client.request("/a"), client.request("/b")]);

    expect(fetchMock.mock.calls.filter((c) => String(c[0]).endsWith("/auth/refresh"))).toHaveLength(1);
  });

  it("does not retry forever when the refresh itself is rejected", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/auth/refresh")) {
        return new Response(JSON.stringify({ code: "INVALID_REFRESH" }), { status: 401 });
      }
      return new Response(JSON.stringify({ code: "UNAUTHORIZED" }), { status: 401 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(new ApiClient("http://api.test").request("/profiles/me")).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).endsWith("/auth/refresh"))).toHaveLength(1);
  });
});

describe("toQuery", () => {
  it("omits unset values", () => {
    expect(toQuery({})).toBe("");
    expect(toQuery({ limit: 20 })).toBe("?limit=20");
  });

  it("clamps page to the range the API accepts", () => {
    // PaginationQuerySchema declares page minimum 1, so emitting ?page=0 is a
    // guaranteed VALIDATION_ERROR round trip.
    expect(toQuery({ page: 0 })).toBe("?page=1");
    expect(toQuery({ page: -5 })).toBe("?page=1");
    expect(toQuery({ page: 3 })).toBe("?page=3");
  });

  it("clamps limit to the range the API accepts", () => {
    expect(toQuery({ limit: 0 })).toBe("?limit=1");
    expect(toQuery({ limit: 5000 })).toBe("?limit=100");
  });
});
