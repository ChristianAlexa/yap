# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `empty_input` return shape — `speak` returns a structured error instead of sending an empty string to Kokoros when the text is empty after markdown stripping.
- `write_failed` return shape — temp file write errors now surface as a structured error instead of an unhandled exception.
- GitHub Actions CI workflow running `npm test` and `node smoke.js --dead-port` on Node 20.11 and 22.
- `Makefile` with launchd management targets and smoke test shortcuts.
- `com.yap.kokoros.plist.template` — template the Makefile renders for `make install`.
- `.prettierrc` documenting the formatting contract.

### Fixed
- Cleared moderate `npm audit` finding by updating transitive `hono` dependency.

## [0.1.0] - 2026-04-15

### Added
- Initial public release.
- MCP server exposing a single `speak` tool that POSTs to a local Kokoros TTS service and plays the resulting audio via `afplay`.
- Markdown stripping so Kokoro doesn't read literal `**`, backticks, headings, etc. aloud.
- Coarse single-flight lock — overlapping `speak` calls return `{ error: "busy" }`.
- Four error return shapes: `tts_unavailable`, `busy`, `playback_failed`, plus the happy path.
- `setup.sh` one-shot installer that checks Node version, installs deps, runs tests, probes Kokoros, and prints the Claude Desktop config snippet (with optional Claude Code registration).
- `smoke.js` end-to-end test harness with `--dead-port` and `--double-call` modes.
- 11-case unit test suite for `strip.js` via `node:test`.
