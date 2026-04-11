import { test } from "node:test";
import assert from "node:assert/strict";
import { stripMarkdown } from "./strip.js";

test("plain text is identity", () => {
  assert.equal(stripMarkdown("Hello world."), "Hello world.");
});

test("ATX headings lose their # markers", () => {
  assert.equal(stripMarkdown("# Chapter One"), "Chapter One");
  assert.equal(stripMarkdown("### Section 3"), "Section 3");
});

test("bold and italic markers are removed", () => {
  assert.equal(
    stripMarkdown("This is **bold** and *italic*."),
    "This is bold and italic.",
  );
  assert.equal(
    stripMarkdown("__also bold__ and _also italic_."),
    "also bold and also italic.",
  );
});

// The atlas callout — fenced code blocks must be removed as whole units, not
// just their fences. This is the first fixture per the plan; it drives the
// implementation.
test("fenced code block is removed entirely — content and all", () => {
  const input = [
    "Before the code.",
    "",
    "```python",
    'print("x")',
    "```",
    "",
    "After the code.",
  ].join("\n");
  const out = stripMarkdown(input);
  assert.match(out, /Before the code\./);
  assert.match(out, /After the code\./);
  assert.doesNotMatch(out, /print/, "python body should not leak through");
  assert.doesNotMatch(out, /```/, "fence markers should not leak through");
  assert.doesNotMatch(out, /`/, "no stray backticks");
});

test("inline code backticks are stripped but content is kept", () => {
  assert.equal(stripMarkdown("Use the `yap` tool."), "Use the yap tool.");
});

test("nested bulleted list keeps item text only", () => {
  const input = ["- outer one", "  - inner", "- outer two"].join("\n");
  const out = stripMarkdown(input);
  assert.match(out, /outer one/);
  assert.match(out, /inner/);
  assert.match(out, /outer two/);
  assert.doesNotMatch(out, /^-/m, "no lines should still start with a bullet");
});

test("link syntax becomes just the link text", () => {
  assert.equal(
    stripMarkdown("See [the docs](https://example.com)."),
    "See the docs.",
  );
});

test("image syntax keeps the alt text", () => {
  assert.equal(stripMarkdown("![a cat](cat.png)"), "a cat");
});

test("block quote prefix is stripped, content preserved", () => {
  assert.equal(stripMarkdown("> quoted thought"), "quoted thought");
});

test("numbered list markers are stripped", () => {
  const input = ["1. first", "2. second", "3. third"].join("\n");
  const out = stripMarkdown(input);
  assert.match(out, /first/);
  assert.match(out, /second/);
  assert.match(out, /third/);
  assert.doesNotMatch(out, /\d\./, "no numbered markers should remain");
});

test("snake_case identifiers are not mangled by underscore italic rule", () => {
  assert.equal(
    stripMarkdown("Edit yap_spec.md and read it."),
    "Edit yap_spec.md and read it.",
  );
});
