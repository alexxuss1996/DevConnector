import { describe, test } from "node:test";
import assert from "node:assert/strict";
import Post from "#modules/posts/posts.model";
import { newId } from "../helpers/stubs.ts";

/** `Post.schema.indexes()` entries are `[fields, options]` tuples. */
function indexFields(): Record<string, unknown>[] {
  return Post.schema
    .indexes()
    .map(([fields]) => fields as Record<string, unknown>);
}

describe("Post model — indexes", () => {
  test("indexes createdAt descending so the feed sort is servable", () => {
    // getPosts sorts by createdAt with no filter, so only a single-field
    // createdAt index can serve it — the {userId, createdAt} compound index
    // cannot, because nothing pins its leading field. Hence the key-count
    // check: `{userId: 1, createdAt: -1}` also "has" a createdAt entry.
    assert.ok(
      indexFields().some(
        (fields) => fields.createdAt === -1 && Object.keys(fields).length === 1,
      ),
      `expected a {createdAt: -1} index, got ${JSON.stringify(indexFields())}`,
    );
  });
});

describe("Post model — serialisation", () => {
  // No posts route declares a response schema, so Fastify JSON.stringifies the
  // document and whatever Mongoose put on it reaches the client verbatim.
  // `versionKey: false` is what keeps `__v` off the wire: Mongoose adds and
  // increments it on every write unless the schema opts out.
  test("the post schema opts out of the mongoose version key", () => {
    assert.equal(Post.schema.options.versionKey, false);
  });

  test("a write never carries __v", () => {
    const doc = new Post({
      userId: newId(),
      name: "Jane Doe",
      text: "Hello world",
    });
    doc.text = "edited";

    // The update document Mongoose would send, i.e. what actually lands in
    // Mongo and comes back on the next read.
    const delta = (doc as unknown as { $__delta(): unknown[] }).$__delta();
    const [, update] = delta as [
      { _id: unknown },
      { $set: Record<string, unknown>; $inc?: unknown },
    ];
    assert.equal("__v" in update.$set, false);
    assert.equal(update.$inc, undefined);
  });

  test("the like and comment subdocuments carry no version key", () => {
    // Both are inline arrays, not separate schemas, so Mongoose never versions
    // them. Asserted so a future promotion to a sub-schema cannot leak one.
    const doc = new Post({
      userId: newId(),
      name: "Jane Doe",
      text: "Hello world",
      likes: [{ userId: newId() }],
      comments: [{ userId: newId(), text: "Nice", name: "Commenter" }],
    });

    const json = doc.toJSON() as unknown as {
      likes: Record<string, unknown>[];
      comments: Record<string, unknown>[];
    };
    for (const sub of [...json.likes, ...json.comments]) {
      assert.equal("__v" in sub, false);
    }
  });
});
