import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeText,
  sanitizePlainText,
  sanitizeUrl,
  sanitizeGithubUsername,
} from "#helpers/sanitize";

describe("sanitizeText", () => {
  test("strips script tags and their contents", () => {
    assert.equal(
      sanitizeText("<p>Hello</p><script>alert(1)</script>"),
      "<p>Hello</p>",
    );
  });

  test("removes event handlers and disallowed img tags", () => {
    assert.equal(sanitizeText("<img src=x onerror=alert(1)>"), "");
    assert.equal(sanitizeText('<p onclick="alert(1)">hi</p>'), "<p>hi</p>");
  });

  test("keeps allowed tags and text", () => {
    assert.ok(
      sanitizeText("<strong>Yes</strong> &lt;safe&gt;").includes(
        "<strong>Yes</strong>",
      ),
    );
  });

  test("forces anchors to a blank target and safe rel", () => {
    const out = sanitizeText('<a href="https://example.com">x</a>');
    assert.ok(out.includes('href="https://example.com"'));
    assert.ok(out.includes('target="_blank"'));
    assert.ok(out.includes('rel="noopener noreferrer"'));
  });

  test("drops javascript: links", () => {
    const out = sanitizeText('<a href="javascript:alert(1)">x</a>');
    assert.ok(!out.includes("javascript:"));
  });

  test("drops non-https links", () => {
    const out = sanitizeText('<a href="http://example.com">x</a>');
    assert.ok(!out.includes('href="http'));
  });
});

describe("sanitizePlainText", () => {
  test("strips all markup", () => {
    assert.equal(sanitizePlainText("<p>Hello <b>world</b></p>"), "Hello world");
  });

  test("trims surrounding whitespace", () => {
    assert.equal(sanitizePlainText("  hello  "), "hello");
  });

  test("preserves ampersands and angle brackets (no entity re-encoding)", () => {
    assert.equal(sanitizePlainText("Jane & Doe"), "Jane & Doe");
    assert.equal(
      sanitizePlainText("100% & 200% <b>done</b>"),
      "100% & 200% done",
    );
    assert.equal(sanitizePlainText("a < b"), "a < b");
  });

  test("returns empty string for falsy or blank input", () => {
    assert.equal(sanitizePlainText(undefined), "");
    assert.equal(sanitizePlainText(null), "");
    assert.equal(sanitizePlainText(""), "");
    assert.equal(sanitizePlainText("   "), "");
  });

  test("removes script content entirely", () => {
    assert.equal(sanitizePlainText("<script>alert(1)</script>"), "");
  });
});

describe("sanitizeUrl", () => {
  test("accepts https URLs", () => {
    assert.equal(
      sanitizeUrl("https://example.com/docs"),
      "https://example.com/docs",
    );
  });

  test("accepts http URLs", () => {
    assert.equal(sanitizeUrl("http://example.com"), "http://example.com");
  });

  test("preserves ampersands in query strings", () => {
    assert.equal(
      sanitizeUrl("https://example.com/?a=1&b=2"),
      "https://example.com/?a=1&b=2",
    );
  });

  test("rejects non-http(s) schemes", () => {
    assert.equal(sanitizeUrl("javascript:alert(1)"), "");
    assert.equal(sanitizeUrl("data:text/html;base64,PHNjcmlwdD4="), "");
    assert.equal(sanitizeUrl("mailto:x@example.com"), "");
  });

  test("trims surrounding whitespace before parsing", () => {
    assert.equal(
      sanitizeUrl("  https://example.com/docs  "),
      "https://example.com/docs",
    );
  });

  test("returns empty string for invalid or missing input", () => {
    assert.equal(sanitizeUrl("not a url"), "");
    assert.equal(sanitizeUrl(undefined), "");
    assert.equal(sanitizeUrl(null), "");
  });
});

describe("sanitizeGithubUsername", () => {
  test("strips a leading @", () => {
    assert.equal(sanitizeGithubUsername("@octocat"), "octocat");
  });

  test("strips markup", () => {
    assert.equal(sanitizeGithubUsername("<b>octo</b>cat"), "octocat");
  });

  test("returns empty string for missing or blank input", () => {
    assert.equal(sanitizeGithubUsername(undefined), "");
    assert.equal(sanitizeGithubUsername(null), "");
    assert.equal(sanitizeGithubUsername("   "), "");
  });
});
