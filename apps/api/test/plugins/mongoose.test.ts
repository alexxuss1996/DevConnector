import { describe, test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import Fastify from "fastify";

/** Source with comments removed, so an assertion cannot match prose about the thing. */
function codeOnly(relativePath: string): string {
  return readFileSync(
    path.join(import.meta.dirname, "..", "..", relativePath),
    "utf8",
  )
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

const originalUri = process.env.MONGODB_URI;

afterEach(() => {
  // Restored, not deleted: #config/env throws on import without it.
  if (originalUri === undefined) delete process.env.MONGODB_URI;
  else process.env.MONGODB_URI = originalUri;
});

/**
 * The plugin is the only caller of `mongoose.connect`, so it tracks the URI it
 * connected to rather than reading Mongoose's private
 * `connection._connectionString`.
 */
describe("mongoose plugin — connection ownership", () => {
  test("does not read Mongoose's private _connectionString", () => {
    assert.ok(
      !codeOnly("src/plugins/mongoose.ts").includes("_connectionString"),
      "mongoose.connection._connectionString is private API with no compatibility guarantee",
    );
  });

  test("disconnects on close, including when reusing a live connection", async () => {
    // Stubs rather than a real server: the unit suite has no Mongo, and the
    // integration suite already exercises the real connect path.
    const mongoose = (await import("mongoose")).default;
    const { stubMethod, restoreAllStubs } = await import("../helpers/stubs.ts");

    const setReadyState = (value: number) =>
      Object.defineProperty(mongoose.connection, "readyState", {
        value,
        configurable: true,
      });

    const disconnect = stubMethod(mongoose, "disconnect", async () => {
      setReadyState(0);
    });
    stubMethod(mongoose, "connect", async () => {
      setReadyState(1);
      return mongoose;
    });

    try {
      const { default: plugin } = await import("#plugins/mongoose");

      const app = Fastify({ logger: false });
      await app.register(plugin);
      await app.ready();
      assert.equal(
        disconnect.mock.callCount(),
        0,
        "a fresh connect must not disconnect first",
      );
      await app.close();
      assert.equal(
        disconnect.mock.callCount(),
        1,
        "close must disconnect on the connect path",
      );

      // A second app now hits the reuse branch — already connected, same URI.
      // It must also own the close hook, or it closes without disconnecting and
      // leaks the connection into the next process.
      const second = Fastify({ logger: false });
      await second.register(plugin);
      await second.ready();
      await second.close();
      assert.equal(
        disconnect.mock.callCount(),
        2,
        "the already-connected branch must register onClose too",
      );
    } finally {
      restoreAllStubs();
    }
  });
});
