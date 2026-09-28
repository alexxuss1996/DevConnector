import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { appendDbSuffix, toLocalMongoUri } from "./integration.ts";

describe("toLocalMongoUri", () => {
  test("keeps host and database from a simple URI", () => {
    assert.equal(
      toLocalMongoUri("mongodb://localhost:27018/devconnector_test"),
      "mongodb://localhost:27018/devconnector_test",
    );
  });

  test("defaults the database name when the URI has none", () => {
    assert.equal(
      toLocalMongoUri("mongodb://localhost:27018"),
      "mongodb://localhost:27018/devconnector_test",
    );
  });

  test("accepts the multi-host Atlas URI from .env.example", () => {
    // The exact shape .env.example documents as the alternative. `new URL`
    // rejects a comma-separated host list, which is what this function
    // exists to normalise.
    const atlas =
      "mongodb://user:pass@shard-00.xxx.mongodb.net:27017,shard-01.xxx.mongodb.net:27017,shard-02.xxx.mongodb.net:27017/?ssl=true&replicaSet=atlas-xxxx-shard-0&authSource=admin&appName=Cluster0";
    const result = toLocalMongoUri(atlas);
    // First host only, no credentials, no cluster query params, and that
    // example has no database name so the default applies.
    assert.equal(
      result,
      "mongodb://shard-00.xxx.mongodb.net:27017/devconnector_test",
    );
  });

  test("reads the database name after the last host of a replica set", () => {
    assert.equal(
      toLocalMongoUri(
        "mongodb://a.example.com:27017,b.example.com:27017/mydb?replicaSet=rs0",
      ),
      "mongodb://a.example.com:27017/mydb",
    );
  });
});

describe("appendDbSuffix", () => {
  test("appends to an existing database name", () => {
    assert.equal(
      appendDbSuffix("mongodb://localhost:27018/dev", "abc123"),
      "mongodb://localhost:27018/dev_abc123",
    );
  });

  test("handles a URI with no database name", () => {
    assert.equal(
      appendDbSuffix("mongodb://localhost:27018", "abc123"),
      "mongodb://localhost:27018/_abc123",
    );
  });
});
