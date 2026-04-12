# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

`yap` is a thin **MCP wrapper** that lets Claude Desktop call a local TTS engine (Kokoros) as a `speak` tool. It is deliberately one of several clients of Kokoros — not the platform itself.

```
Kokoros (native Rust binary, port 3000)  ← the actual TTS service
    ↑
    ├── yap (this repo) → Claude Desktop via MCP stdio
    ├── Hermes / voice-loop / other agents → direct HTTP POST
    └── CLI pipe → `echo text | koko stream`
```

Key consequence: **yap stays tiny.** One file (`index.js`) for the MCP server, one pure function (`strip.js`) for markdown stripping, one harness (`smoke.js`) for end-to-end assertions. Dependencies: `@modelcontextprotocol/sdk` and `zod`. Nothing else. Anything that would benefit multiple agents belongs in Kokoros or a shared script, not inside yap.

## Architectural Decisions (don't relitigate without reason)

- **Kokoros (Rust) over kokoro-web (Python/Docker)**: single native binary, streaming support, CLI piping, ONNX runtime. CPU-only is fine — Kokoro-82M is faster than real-time on M1 Max.
- **OpenAI-compatible `/v1/audio/speech` contract**: every client (yap, Hermes, scripts) talks the same API, so the backend is swappable without touching clients.
- **Audio playback is the caller's responsibility.** yap uses `afplay` (macOS). Linux support is not in v1 — if added, abstract the player rather than hardcoding a second branch.
- **No auth on Kokoros.** Local-only. If that changes, add a reverse proxy — don't bake auth into yap.
- **Coarse single-flight lock.** One `speak` call at a time — covers both synthesis and playback. Overlapping calls return `{ error: "busy" }` immediately. Serializing synth+playback together is a conscious call: concurrent synth with serialized playback is complexity for an edge case that doesn't happen in practice.
- **No `stream` param, no `voices` tool.** Explicitly cut from v1. The 54 voices Kokoros exposes are addressable by ID through the `voice` param; a hardcoded reference list in yap would just drift.

## The `speak` Tool Contract

**Parameters:** `text` (required), `voice` (optional — leave unset to use the configured default).

The tool description tells Claude to omit `voice` unless the user explicitly asks for one. Without that nudge, Claude tends to pass a voice argument unprompted, overriding `KOKORO_DEFAULT_VOICE`. If you change the description, preserve that instruction.

**Behavior, in order:**
1. Acquire the single-flight lock. If already held, return `{ error: "busy", detail }` immediately.
2. Strip markdown from `text` via `stripMarkdown` — headings, bold, backticks, bullets, code fences, links. Kokoro reads literal characters, so unstripped markdown sounds terrible.
3. POST to `${KOKORO_URL}/v1/audio/speech` with `{ model: "tts-1", voice, input }`.
4. If the POST rejects (ECONNREFUSED etc.) or returns non-2xx: return `{ error: "tts_unavailable", detail }`. Do not throw.
5. Write the audio body to `/tmp/yap_<timestamp>.wav`.
6. Spawn `afplay` on the temp file, measure wall-clock duration from spawn to exit (playback only, not synth+playback).
7. Unlink the temp file in a `finally`.
8. Release the lock in the outer `finally`.
9. Return `{ voice, duration_ms, char_count, stripped_text }`.

**Env vars:** `KOKORO_URL` (default `http://localhost:3000`), `KOKORO_DEFAULT_VOICE` (default `af_heart`). Both read inside the handler per-call — not captured at import time. Verified by `smoke.js --dead-port` and by `KOKORO_DEFAULT_VOICE=<id> node smoke.js`.

**Return shapes (three):**
- Happy: `{ voice, duration_ms, char_count, stripped_text }`
- Unreachable: `{ error: "tts_unavailable", detail }`
- Concurrent: `{ error: "busy", detail }`

## Running Kokoros (dependency, not part of this repo)

Kokoros lives in a separate repo (`github.com/lucasjinreal/Kokoros`). For yap to work, Kokoros must be running:

```bash
koko openai    # binds 0.0.0.0:3000, two instances by default
```

Note: older Kokoros docs mention a `--instances 1` flag for lowest latency. The currently shipped binary does not accept it — default `koko openai` is what works.

## Commands

```bash
npm install                 # install deps (@modelcontextprotocol/sdk, zod)
npm test                    # run strip.js unit tests (11 cases, node:test)
node smoke.js               # happy path: plays audio, asserts return shape + temp-file cleanup
node smoke.js --dead-port   # asserts tts_unavailable when Kokoros is down
node smoke.js --double-call # asserts the single-flight busy lock
```

Requires Node 20.11+ (for stable `node:test` + global `fetch`). ESM throughout (`"type": "module"`).

`smoke.js` requires Kokoros running on `KOKORO_URL` (default `:3000`) — except `--dead-port` mode, which deliberately overrides to a closed port.

## When Extending

- New capability that only Claude Desktop needs → add to yap.
- New capability that any agent could use → add to Kokoros or a shared script, and let yap call it like everyone else.
- If a new return shape is added to `speak`, update the three-shape list above and add an assertion mode to `smoke.js`.
- Stay tiny. No new deps without a concrete reason.
