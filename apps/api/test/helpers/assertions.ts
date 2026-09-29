import assert from "node:assert/strict";

type ReplyLike = { json(): any; headers: Record<string, any> };

/**
 * Asserts an error body's code and message, and that the requestId is a real
 * correlation id rather than a restatement of itself.
 *
 * The pattern this replaces —
 *   assert.deepEqual(reply.json(), { ..., requestId: reply.json().requestId })
 * — reads the expected value out of the actual object, so it only proves the
 * key is present. This checks it is a non-empty string that matches the
 * x-request-id header, which is the correlation contract a client relies on
 * when it quotes a request id back to whoever operates the service.
 */
export function assertErrorBody(
  reply: ReplyLike,
  expected: { code: string; message: string },
): void {
  const body = reply.json();
  assert.equal(body.code, expected.code);
  assert.equal(body.message, expected.message);
  assert.deepEqual(Object.keys(body).sort(), [
    "code",
    "message",
    "requestId",
  ]);
  assert.equal(typeof body.requestId, "string");
  assert.notEqual(body.requestId, "");
  assert.equal(body.requestId, reply.headers["x-request-id"]);
}
