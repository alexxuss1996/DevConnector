import { describe, test, before, after, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { profileService } from "#modules/profile/profile.service";
import { newId } from "../helpers/stubs.ts";
import { buildApp, signAccessToken, signRefreshToken } from "../helpers/app.ts";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

before(async () => {
  app = await buildApp({ withRoutes: true });
});

after(async () => {
  await app.close();
  // restore fetch mock if any
  try { (global.fetch as any).mock?.restore?.(); } catch {}
  mock.restoreAll();
});

afterEach(() => {
  mock.restoreAll();
  // ensure fetch restored
  if ((global.fetch as any).mock) {
    try { (global.fetch as any).mock.restore(); } catch {}
  }
});

function authHeader(userId?: string) {
  const id = userId ?? newId().toString();
  return { authorization: `Bearer ${signAccessToken(app, { sub: id })}` };
}

function mockFetchSuccess(repos: any[]) {
  const fetchMock = mock.method(global, "fetch", async () => ({
    ok: true,
    status: 200,
    json: async () => repos,
  } as any));
  return fetchMock;
}

function mockFetchNotFound(body: any = { message: "Not Found" }) {
  const fetchMock = mock.method(global, "fetch", async () => ({
    ok: false,
    status: 404,
    json: async () => body,
  } as any));
  return fetchMock;
}

// ============================================================
// GET /profile/github/:username — authentication
// ============================================================
describe("GET /profile/github/:username — authentication", () => {
  test("returns 401 without token", async () => {
    const reply = await app.inject({ method: "GET", url: "/profile/github/octocat" });
    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), { code: "FAILED_AUTHENTICATION", message: "Unauthorized" });
  });

  test("returns 401 for empty Bearer token", async () => {
    const reply = await app.inject({
      method: "GET",
      url: "/profile/github/octocat",
      headers: { authorization: "Bearer " },
    });
    assert.equal(reply.statusCode, 401);
  });

  test("returns 401 for refresh token (must be access)", async () => {
    const refresh = signRefreshToken(app, { sub: newId().toString(), sessionId: newId().toString() });
    const reply = await app.inject({
      method: "GET",
      url: "/profile/github/octocat",
      headers: { authorization: `Bearer ${refresh}` },
    });
    assert.equal(reply.statusCode, 401);
    assert.deepEqual(reply.json(), { code: "FAILED_AUTHENTICATION", message: "Unauthorized" });
  });

  test("returns 401 for tampered access token", async () => {
    const token = signAccessToken(app, { sub: newId().toString() });
    const reply = await app.inject({
      method: "GET",
      url: "/profile/github/octocat",
      headers: { authorization: `Bearer ${token}x` },
    });
    assert.equal(reply.statusCode, 401);
  });

  test("accepts access token from cookie", async () => {
    const userId = newId();
    const token = signAccessToken(app, { sub: userId.toString() });
    const repos = [{ id: 1, name: "repo1" }];
    mockFetchSuccess(repos);

    const reply = await app.inject({
      method: "GET",
      url: "/profile/github/octocat",
      cookies: { access_token: token },
    });
    assert.equal(reply.statusCode, 200);
    assert.deepEqual(reply.json(), repos);
  });

  test("returns 200 for valid Bearer token", async () => {
    const repos = [{ id: 1, name: "hello-world" }];
    mockFetchSuccess(repos);

    const reply = await app.inject({
      method: "GET",
      url: "/profile/github/octocat",
      headers: authHeader(),
    });
    assert.equal(reply.statusCode, 200);
    assert.deepEqual(reply.json(), repos);
  });
});

// ============================================================
// GET /profile/github/:username — logic & fetch integration
// ============================================================
describe("GET /profile/github/:username — logic", () => {
  test("returns 200 with repos array on success", async () => {
    const mockRepos = [
      { id: 1, name: "repo1", html_url: "https://github.com/octocat/repo1" },
      { id: 2, name: "repo2", html_url: "https://github.com/octocat/repo2" },
    ];
    mockFetchSuccess(mockRepos);

    const reply = await app.inject({
      method: "GET",
      url: "/profile/github/octocat",
      headers: authHeader(),
    });

    assert.equal(reply.statusCode, 200);
    const body = reply.json() as any[];
    assert.ok(Array.isArray(body));
    assert.equal(body.length, 2);
    assert.equal(body[0].name, "repo1");
  });

  test("calls fetch with correct URL (username, per_page=5, sort=created:asc)", async () => {
    const repos = [{ id: 1, name: "r" }];
    const fetchMock = mockFetchSuccess(repos);

    const reply = await app.inject({
      method: "GET",
      url: "/profile/github/testuser123",
      headers: authHeader(),
    });

    assert.equal(reply.statusCode, 200);
    assert.equal(fetchMock.mock.callCount(), 1);
    const [url] = fetchMock.mock.calls[0].arguments as any[];
    assert.ok(url.includes("https://api.github.com/users/testuser123/repos"));
    assert.ok(url.includes("per_page=5"));
    assert.ok(url.includes("sort=created") && url.includes("direction=asc"));
  });

  test("sends correct headers (User-Agent, Accept, Authorization with token)", async () => {
    const original = process.env.GITHUB_ACCESS_TOKEN;
    process.env.GITHUB_ACCESS_TOKEN = "test-pat-123";

    const repos = [{ id: 1, name: "r" }];
    const fetchMock = mockFetchSuccess(repos);

    const reply = await app.inject({
      method: "GET",
      url: "/profile/github/octocat",
      headers: authHeader(),
    });

    assert.equal(reply.statusCode, 200);
    const [, opts] = fetchMock.mock.calls[0].arguments as any[];
    assert.equal(opts.headers["User-Agent"], "node.js");
    assert.equal(opts.headers.Accept, "application/vnd.github.v3+json");
    assert.equal(opts.headers.Authorization, "token test-pat-123");

    // restore
    if (original === undefined) delete process.env.GITHUB_ACCESS_TOKEN;
    else process.env.GITHUB_ACCESS_TOKEN = original;
  });

  test("returns 404 GITHUB_REPOS_NOT_FOUND when GitHub returns non-ok", async () => {
    mockFetchNotFound({ message: "Not Found" });

    const reply = await app.inject({
      method: "GET",
      url: "/profile/github/nonexistentuser12345",
      headers: authHeader(),
    });

    assert.equal(reply.statusCode, 404);
    assert.equal((reply.json() as any).code, "GITHUB_REPOS_NOT_FOUND");
    assert.equal((reply.json() as any).message, "No repos found");
  });

  test("returns 404 when GitHub user has no repos (empty array but non-ok)", async () => {
    // Even empty array with ok false should be 404 per service logic
    mockFetchNotFound([]);

    const reply = await app.inject({
      method: "GET",
      url: "/profile/github/emptyuser",
      headers: authHeader(),
    });

    assert.equal(reply.statusCode, 404);
    assert.equal((reply.json() as any).code, "GITHUB_REPOS_NOT_FOUND");
  });

  test("returns 500 for fetch network error (unexpected error)", async () => {
    mock.method(global, "fetch", async () => {
      throw new Error("network boom");
    });

    const reply = await app.inject({
      method: "GET",
      url: "/profile/github/octocat",
      headers: authHeader(),
    });

    assert.equal(reply.statusCode, 500);
    assert.deepEqual(reply.json(), { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" });
  });

  test("returns 500 when fetch json throws", async () => {
    mock.method(global, "fetch", async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new Error("json parse boom"); },
    } as any));

    const reply = await app.inject({
      method: "GET",
      url: "/profile/github/octocat",
      headers: authHeader(),
    });

    assert.equal(reply.statusCode, 500);
  });
});

// ============================================================
// profileService.getGithubReposForProfile — unit (direct fetch mock)
// ============================================================
describe("profileService.getGithubReposForProfile — unit", () => {
  test("calls fetch with correct URL and headers and returns repos", async () => {
    const original = process.env.GITHUB_ACCESS_TOKEN;
    process.env.GITHUB_ACCESS_TOKEN = "unit-test-token";

    const expected = [{ id: 42, name: "my-repo" }];
    const fetchMock = mock.method(global, "fetch", async (url: string, opts: any) => {
      assert.equal(url, "https://api.github.com/users/octocat/repos?per_page=5&sort=created&direction=asc");
      assert.equal(opts.headers["User-Agent"], "node.js");
      assert.equal(opts.headers.Accept, "application/vnd.github.v3+json");
      assert.equal(opts.headers.Authorization, "token unit-test-token");
      return { ok: true, status: 200, json: async () => expected } as any;
    });

    const result = await profileService.getGithubReposForProfile("octocat");
    assert.deepEqual(result, expected);
    assert.equal(fetchMock.mock.callCount(), 1);

    if (original === undefined) delete process.env.GITHUB_ACCESS_TOKEN;
    else process.env.GITHUB_ACCESS_TOKEN = original;
  });

  test("throws 404 GITHUB_REPOS_NOT_FOUND when response.ok is false", async () => {
    mock.method(global, "fetch", async () => ({
      ok: false,
      status: 404,
      json: async () => ({ message: "Not Found" }),
    } as any));

    await assert.rejects(
      () => profileService.getGithubReposForProfile("unknown123"),
      (err: any) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, "GITHUB_REPOS_NOT_FOUND");
        assert.equal(err.message, "No repos found");
        return true;
      }
    );
  });

  test("propagates fetch throw as unhandled (will be 500 at route layer)", async () => {
    mock.method(global, "fetch", async () => { throw new Error("fetch failed"); });

    await assert.rejects(
      () => profileService.getGithubReposForProfile("octocat"),
      (err: any) => {
        assert.equal(err.message, "fetch failed");
        return true;
      }
    );
  });

  test("handles Authorization header when GITHUB_ACCESS_TOKEN is undefined (token undefined)", async () => {
    const original = process.env.GITHUB_ACCESS_TOKEN;
    delete process.env.GITHUB_ACCESS_TOKEN;

    let capturedAuth: string | undefined;
    mock.method(global, "fetch", async (_url: string, opts: any) => {
      capturedAuth = opts.headers.Authorization;
      return { ok: true, json: async () => [] } as any;
    });

    const result = await profileService.getGithubReposForProfile("octocat");
    assert.deepEqual(result, []);
    assert.equal(capturedAuth, "token undefined");

    if (original !== undefined) process.env.GITHUB_ACCESS_TOKEN = original;
  });
});
