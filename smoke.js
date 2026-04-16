// End-to-end smoke test. Requires Kokoros running on KOKORO_URL
// (default http://localhost:3000) except in --dead-port and --empty-input modes.
// Modes:
//   (default)      Phase 3 happy-path assertions + /tmp leak check.
//   --dead-port    Points at a closed port, asserts tts_unavailable shape.
//   --double-call  Fires two overlapping calls, asserts one busy + one success.
//   --empty-input  Sends a fenced-only input, asserts empty_input shape (no Kokoros call).

import assert from "node:assert/strict";
import fs from "node:fs";
import { speak } from "./index.js";

function snapshot() {
  return new Set(
    fs.readdirSync("/tmp").filter((f) => f.startsWith("yap_") && f.endsWith(".wav")),
  );
}

const mode = process.argv[2];

if (mode === "--dead-port") {
  try {
    process.env.KOKORO_URL = "http://localhost:9999";
    const result = await speak({ text: "Hello from yap." });
    assert.equal(result.error, "tts_unavailable", `expected tts_unavailable, got ${JSON.stringify(result)}`);
    assert.equal(typeof result.detail, "string", "detail should be a string");
    console.log("smoke --dead-port ok:", JSON.stringify(result));
  } catch (err) {
    console.error("smoke --dead-port FAILED:", err.message ?? err);
    process.exit(1);
  }
} else if (mode === "--empty-input") {
  try {
    // Input that is entirely a fenced code block — strips to "".
    const input = ["```python", 'print("x")', "```"].join("\n");
    const result = await speak({ text: input });
    assert.equal(result.error, "empty_input", `expected empty_input, got ${JSON.stringify(result)}`);
    assert.equal(typeof result.detail, "string", "detail should be a string");
    console.log("smoke --empty-input ok:", JSON.stringify(result));
  } catch (err) {
    console.error("smoke --empty-input FAILED:", err.message ?? err);
    process.exit(1);
  }
} else if (mode === "--double-call") {
  try {
    const p1 = speak({ text: "First call from yap." });
    const p2 = speak({ text: "Second call from yap." });
    const [r1, r2] = await Promise.all([p1, p2]);

    const busy = [r1, r2].filter((r) => r && r.error === "busy");
    const happy = [r1, r2].filter((r) => r && typeof r.voice === "string" && r.duration_ms > 0);
    assert.equal(busy.length, 1, `expected exactly one busy, got ${JSON.stringify([r1, r2])}`);
    assert.equal(happy.length, 1, `expected exactly one happy, got ${JSON.stringify([r1, r2])}`);
    assert.equal(busy[0].detail, "playback in progress");
    console.log("smoke --double-call ok:", JSON.stringify({ r1, r2 }));
  } catch (err) {
    console.error("smoke --double-call FAILED:", err.message ?? err);
    process.exit(1);
  }
} else {
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
}
