# yap

Thin MCP wrapper so Claude Desktop can call a local [Kokoros](https://github.com/lucasjinreal/Kokoros) TTS engine as a `speak` tool. One file, stdio transport, macOS-only playback via `afplay`.

The `speak` tool strips markdown, POSTs to Kokoros's OpenAI-compatible `/v1/audio/speech` endpoint, plays the returned WAV, and returns `{ voice, duration_ms, char_count, stripped_text }`. On failure it returns `{ error: "tts_unavailable" | "busy", detail }`.

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

## Verify it works

With Kokoros running on port 3000:

```bash
npm test                    # strip.js unit tests (11 cases)
node smoke.js               # happy path: plays audio, asserts shape
node smoke.js --dead-port   # asserts tts_unavailable when Kokoros is down
node smoke.js --double-call # asserts the single-flight busy lock
```
