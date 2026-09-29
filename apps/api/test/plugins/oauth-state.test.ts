import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import cookiePlugin from "#plugins/cookie";

/**
 * The Google OAuth callback's `state` check compares the `state` query
 * parameter against the state cookie. On its own that only proves two values
 * match, so anyone able to write a cookie for this host — an on-path attacker,
 * a sibling subdomain — can plant both the state and the PKCE verifier and
 * force the victim's browser to log into the attacker's account (login CSRF).
 *
 * `@fastify/oauth2` closes that with `cookie: { signed: true }`: it signs the
 * state and verifier cookies and unsigns them before comparing. That only works
 * if the app's `@fastify/cookie` was registered with a secret, because
 * `signCookie`/`unsignCookie` are decorated *only* when `secret` is defined.
 * With no secret the check would fail on every callback and break sign-in.
 */
describe("oauth state cookie signing", () => {
  test("the cookie plugin registers a secret, so sign/unsign exist", async () => {
    const app = Fastify();
    await app.register(cookiePlugin);
    await app.ready();

    assert.equal(
      typeof app.signCookie,
      "function",
      "@fastify/cookie only decorates signCookie when registered with a secret; " +
        "without one, `cookie: { signed: true }` would make every OAuth callback fail",
    );
    assert.equal(typeof app.unsignCookie, "function");
    await app.close();
  });

  test("a signed value verifies and a planted one does not", async () => {
    const app = Fastify();
    await app.register(cookiePlugin);
    await app.ready();

    const signed = app.signCookie("attacker-independent-state");
    const verified = app.unsignCookie(signed);
    assert.equal(verified.valid, true, "a genuinely signed cookie must verify");
    assert.equal(verified.value, "attacker-independent-state");

    // An attacker can write this value into a cookie header directly — it is
    // never signed, so the state check must refuse it.
    const planted = app.unsignCookie("attacker-independent-state");
    assert.equal(
      planted.valid,
      false,
      "an unsigned planted value must not verify, or the state cookie is forgeable",
    );

    // And a tampered signature must fail too.
    const tampered = app.unsignCookie(`${signed.slice(0, -1)}x`);
    assert.equal(tampered.valid, false, "a tampered signature must not verify");

    await app.close();
  });

  test("the oauth2 plugin opts into signed state and verifier cookies", () => {
    const source = readFileSync(
      path.join(import.meta.dirname, "..", "..", "src", "plugins", "oauth.ts"),
      "utf8",
    );
    assert.match(
      source,
      /cookie:\s*\{\s*signed:\s*true\s*\}/,
      "src/plugins/oauth.ts must pass `cookie: { signed: true }` to @fastify/oauth2, " +
        "otherwise the state cookie is unsigned and the flow is forgeable",
    );
  });
});
