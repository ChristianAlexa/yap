# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

**Greenfield / pre-implementation.** The only file in the repo is `yap-spec.md`, which is the source of truth for what `yap` should become. No code has been written yet. Read `yap-spec.md` before making changes — it defines the architecture, the tool contract, and the non-obvious tradeoffs.

## What This Repo Is

`yap` is a thin **MCP wrapper** that lets Claude Desktop call a local TTS engine (Kokoros) as a `speak` tool. It is deliberately one of several clients of Kokoros — not the platform itself.

```
Kokoros (native Rust binary, port 3000)  ← the actual TTS service
    ↑
    ├── yap (this repo) → Claude Desktop via MCP stdio
    ├── Hermes / voice-loop / other agents → direct HTTP POST
    └── CLI pipe → `echo text | koko stream`
```

Key consequence: **yap should stay tiny.** One file, minimal deps, stdio MCP transport. Anything that would benefit multiple agents belongs in Kokoros or as a shared script, not inside yap.

## Architectural Decisions (from the spec — don't relitigate without reason)

- **Kokoros (Rust) over kokoro-web (Python/Docker)**: single native binary, streaming support, CLI piping, ONNX runtime. CPU-only is fine — Kokoro-82M is faster than real-time on M1 Max.
- **OpenAI-compatible `/v1/audio/speech` contract**: every client (yap, Hermes, scripts) talks the same API, so the backend is swappable (kokoro-web, hosted API, etc.) without touching clients.
- **Audio playback is the caller's responsibility.** yap uses `afplay` (macOS). If Linux support is ever added (e.g. Raspberry Pi), abstract the player — don't hardcode a second branch.
- **No auth on Kokoros.** Local-only. If that changes, add a reverse proxy — don't bake auth into yap.

## The `speak` Tool Contract

Parameters: `text` (required), `voice` (default `"af_heart"`), `stream` (default `false`).

Behavior, in order:
1. **Strip markdown** from `text` before sending — headings, bold, backticks, bullets, code fences. Kokoro reads literal characters, so unstripped markdown sounds terrible.
2. POST to `${KOKORO_URL}/v1/audio/speech` with `{ model: "tts-1", voice, input }`.
3. Write audio blob to `/tmp/yap_<timestamp>.wav`.
4. Spawn `afplay` on the temp file.
5. Clean up the temp file after playback.
6. Return `{ success: true }`.

Env vars (from the Claude Desktop config example): `KOKORO_URL`, `KOKORO_DEFAULT_VOICE`.

## Running Kokoros (dependency, not part of this repo)

Kokoros lives in a separate repo (`github.com/lucasjinreal/Kokoros`). For yap to work, Kokoros must be running:

```bash
koko openai --instances 1    # lowest latency, best for conversational use
```

Server listens on port 3000. The spec includes a launchd plist template if always-on is wanted.

## Commands

No build/test commands yet — they'll be added once an implementation language is chosen. The spec implies Node.js (`"command": "node", "args": [".../yap/index.js"]` in the Claude Desktop config example), but that's not locked in. Confirm with the user before scaffolding.

## When Extending

- New capability that only Claude Desktop needs → add to yap.
- New capability that any agent could use → add to Kokoros or a shared script, and let yap call it like everyone else.
- Voice list can be hardcoded initially (see the reference list in `yap-spec.md`). A `voices` tool is called out as nice-to-have, not required.
