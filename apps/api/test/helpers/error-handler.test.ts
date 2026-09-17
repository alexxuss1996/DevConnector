import { describe, test, mock } from "node:test";
import assert from "node:assert/strict";
import { errorHandler } from "#helpers/error-handler";
import AppError from "#helpers/app-error";
import type { FastifyReply, FastifyRequest } from "fastify";

function fakeRequest(logError = mock.fn()): FastifyRequest {
  return { log: { error: logError } } as unknown as FastifyRequest;
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
    });
  });

  test("maps validation errors to 400 VALIDATION_ERROR with field details", async () => {
    const { reply, captured } = fakeReply();
    const validationError = Object.assign(new Error("validation failed"), {
      validation: [
        { instancePath: "/email", keyword: "format", message: "must match format" },
        { instancePath: "/password", keyword: "minLength", message: "too short" },
      ],
    }) as any;

    await errorHandler(validationError, fakeRequest(), reply);

    assert.equal(captured.status, 400);
    const body = captured.body as any;
    assert.equal(body.code, "VALIDATION_ERROR");
    assert.equal(body.message, "Request validation failed");
    assert.deepEqual(body.errors, [
      { field: "email", keyword: "format", message: "must match format" },
      { field: "password", keyword: "minLength", message: "too short" },
    ]);
    // Zod-like additional fields
    assert.ok(Array.isArray(body.issues));
    assert.equal(body.issues.length, 2);
    assert.deepEqual(body.issues[0].path, ["email"]);
    assert.equal(body.issues[0].code, "format");
    assert.ok(body.fieldErrors);
    assert.deepEqual(body.fieldErrors.email, ["must match format"]);
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
    });
    assert.equal(logError.mock.callCount(), 1);
  });
});
