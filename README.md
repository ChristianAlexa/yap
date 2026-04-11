# yap

Thin MCP wrapper so Claude Desktop can call a local [Kokoros](https://github.com/lucasjinreal/Kokoros) TTS engine as a `speak` tool.

For the full architecture and tool contract, see [`docs/yap-spec.md`](docs/yap-spec.md). For the phased implementation plan, see [`docs/yap-plan.md`](docs/yap-plan.md).

## Status

**Phase 1 — stub only.** `speak` is registered and wired into Claude Desktop, but returns a placeholder result — no markdown stripping, no synthesis, no audio playback yet. Later phases add each of these.

## Prerequisites

- Node ≥ 20.11
- [Kokoros](https://github.com/lucasjinreal/Kokoros) running on `localhost:3000` (`koko openai --instances 1`)
- macOS (playback uses `afplay`)

## Setup

```bash
git clone <this-repo>
cd yap
npm install
```

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "yap": {
      "command": "bash",
      "args": [
        "-c",
        "source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && node /absolute/path/to/yap/index.js"
      ],
      "env": {
        "KOKORO_URL": "http://localhost:3000",
        "KOKORO_DEFAULT_VOICE": "af_heart"
      }
    }
  }
}
```

Fully quit and relaunch Claude Desktop (⌘Q — not just closing the window). The `speak` tool will appear in the tool panel.

## Running directly (without Claude Desktop)

```bash
node index.js   # runs the MCP server on stdio; hangs waiting for JSON-RPC input
```

Smoke-test the stdio handshake:

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0.0.0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | node index.js
```
