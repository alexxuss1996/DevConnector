import { describe, test, mock } from "node:test";
import assert from "node:assert/strict";
import { errorHandler } from "#helpers/error-handler";
import AppError from "#helpers/app-error";
import type { FastifyReply, FastifyRequest } from "fastify";

function fakeRequest(logError = mock.fn()): FastifyRequest {
  return {
    id: "req-test",
    log: { error: logError },
  } as unknown as FastifyRequest;
}

function fakeReply() {
  const captured: { status?: number; body?: unknown } = {};
  const reply: Record<string, unknown> = {
    status(code: number) {
      captured.status = code;
      return reply;
    },
    send(body: unknown) {
      captured.body = body;
      return reply;
    },
  };
  return { reply: reply as unknown as FastifyReply, captured };
}

describe("errorHandler", () => {
  test("maps AppError to its status code, code and message", async () => {
    const { reply, captured } = fakeReply();

    await errorHandler(
      new AppError(409, "EMAIL_IN_USE", "Email already registered"),
      fakeRequest(),
      reply,
    );

    assert.equal(captured.status, 409);
    assert.deepEqual(captured.body, {
      code: "EMAIL_IN_USE",
      message: "Email already registered",
      requestId: "req-test",
    });
  });

  test("maps validation errors to 400 VALIDATION_ERROR with field details", async () => {
    const { reply, captured } = fakeReply();
    const validationError = Object.assign(new Error("validation failed"), {
      validation: [
        {
          instancePath: "/email",
          keyword: "format",
          message: "must match format",
        },
        {
          instancePath: "/password",
          keyword: "minLength",
          message: "too short",
        },
      ],
    }) as any;

    await errorHandler(validationError, fakeRequest(), reply);

    assert.equal(captured.status, 400);
    const body = captured.body as any;
    assert.equal(body.code, "VALIDATION_ERROR");
    assert.equal(body.message, "Request validation failed");
    assert.ok(Array.isArray(body.issues));
    assert.equal(body.issues.length, 2);
    assert.deepEqual(body.issues[0].path, ["email"]);
    assert.equal(body.issues[0].code, "format");
    assert.ok(body.fieldErrors);
    assert.deepEqual(body.fieldErrors.email, ["must match format"]);
  });

  test("does not leak the message of an unexpected 4xx", async () => {
    // A bug that happens to carry a 4xx statusCode used to ship its message
    // verbatim to the client. Only Fastify's own HTTP errors carry text written
    // for users, so only those are forwarded.
    const leaky: any = new Error("db password is hunter2");
    leaky.statusCode = 400;
    leaky.code = "FST_ERR_SOMETHING";

    const { reply, captured } = fakeReply();
    await errorHandler(leaky, fakeRequest(), reply);

    assert.equal(captured.status, 400);
    assert.deepEqual(captured.body, {
      code: "FST_ERR_SOMETHING",
      message: "Bad request",
      requestId: "req-test",
    });
    assert.ok(
      !JSON.stringify(captured.body).includes("hunter2"),
      "internal detail must never reach the client",
    );
  });

  test("still forwards a Fastify-authored 4xx message", async () => {
    // Fastify's own errors (e.g. malformed JSON) are written for users and are
    // far more useful than "Bad request".
    const fastifyError: any = new Error(
      "Body is not valid JSON but content-type is set to 'application/json'",
    );
    fastifyError.name = "FastifyError";
    fastifyError.code = "FST_ERR_CTP_INVALID_JSON_BODY";
    fastifyError.statusCode = 400;

    const { reply, captured } = fakeReply();
    await errorHandler(fastifyError, fakeRequest(), reply);

    assert.equal(captured.status, 400);
    assert.equal(
      (captured.body as any).message,
      "Body is not valid JSON but content-type is set to 'application/json'",
    );
  });

  test("maps unexpected errors to 500 INTERNAL_SERVER_ERROR and logs them", async () => {
    const { reply, captured } = fakeReply();
    const logError = mock.fn();

    await errorHandler(
      new Error("boom") as Parameters<typeof errorHandler>[0],
      fakeRequest(logError),
      reply,
    );

    assert.equal(captured.status, 500);
    assert.deepEqual(captured.body, {
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
      requestId: "req-test",
    });
    assert.equal(logError.mock.callCount(), 1);
  });
});
