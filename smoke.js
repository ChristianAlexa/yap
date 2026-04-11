// End-to-end smoke test for Phase 3. Requires Kokoros running on KOKORO_URL
// (default http://localhost:3000). Asserts the speak() return shape and that
// no /tmp/yap_*.wav file leaks. Exits non-zero on any failure.

import assert from "node:assert/strict";
import fs from "node:fs";
import { speak } from "./index.js";

function snapshot() {
  return new Set(
    fs.readdirSync("/tmp").filter((f) => f.startsWith("yap_") && f.endsWith(".wav")),
  );
}

try {
  const before = snapshot();

  const result = await speak({ text: "Hello from yap." });

  assert.equal(typeof result.voice, "string", "voice should be a string");
  assert.ok(result.voice, "voice should be non-empty");
  assert.ok(result.duration_ms > 0, `duration_ms should be > 0, got ${result.duration_ms}`);
  assert.equal(typeof result.stripped_text, "string", "stripped_text should be a string");
  assert.equal(
    result.char_count,
    result.stripped_text.length,
    "char_count should equal stripped_text.length",
  );

  const after = snapshot();
  const leaked = [...after].filter((f) => !before.has(f));
  assert.equal(leaked.length, 0, `temp file(s) leaked: ${leaked.join(", ")}`);

  console.log("smoke ok:", JSON.stringify(result));
} catch (err) {
  console.error("smoke FAILED:", err.message ?? err);
  process.exit(1);
}
