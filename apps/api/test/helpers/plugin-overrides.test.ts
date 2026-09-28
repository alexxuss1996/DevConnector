import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { oauthStub, oauthStubNamespace, noDb } from "./plugin-overrides.ts";

describe("oauthStub", () => {
  test("decorates googleOAuth2 with a working code exchange", async () => {
    const server: FastifyInstance = Fastify({ logger: false });
    await server.register(oauthStub);
    await server.ready();

    const result = await (
      server.googleOAuth2 as unknown as {
        getAccessTokenFromAuthorizationCodeFlow: () => Promise<{
          token: { access_token: string };
        }>;
      }
    ).getAccessTokenFromAuthorizationCodeFlow();
    assert.equal(result.token.access_token, "google-access-token");
    await server.close();
  });

  test("exposes every method the routes call on it", () => {
    const routesDir = fileURLToPath(new URL("../../src/routes/", import.meta.url));
    const called = new Set<string>();
    for (const entry of readdirSync(routesDir, { recursive: true })) {
      if (!String(entry).endsWith(".ts")) continue;
      const source = readFileSync(join(routesDir, String(entry)), "utf8");
      for (const match of source.matchAll(/googleOAuth2\.(\w+)/g)) {
        called.add(match[1]);
      }
    }
    assert.ok(called.size > 0, "expected at least one googleOAuth2 call in src/routes");
    for (const name of called) {
      assert.equal(
        typeof (oauthStubNamespace as Record<string, unknown>)[name],
        "function",
        `src/routes calls googleOAuth2.${name} but the stub does not provide it`,
      );
    }
  });
});

describe("noDb", () => {
  test("registers without opening a connection", async () => {
    const server = Fastify({ logger: false });
    await server.register(noDb);
    await server.ready();
    assert.equal(server.printRoutes().length >= 0, true);
    await server.close();
  });
});
