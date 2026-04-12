# yap

Thin MCP wrapper so Claude Desktop can call a local [Kokoros](https://github.com/lucasjinreal/Kokoros) TTS engine as a `speak` tool. One file, stdio transport, macOS-only playback via `afplay`.

The `speak` tool strips markdown, POSTs to Kokoros's OpenAI-compatible `/v1/audio/speech` endpoint, plays the returned WAV, and returns `{ voice, duration_ms, char_count, stripped_text }`. On failure it returns `{ error: "tts_unavailable" | "busy" | "playback_failed", detail }`.

## Prerequisites

- Node ≥ 20.11
- [Kokoros](https://github.com/lucasjinreal/Kokoros) running on `localhost:3000` (`koko openai`) — uses the [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) model (Apache 2.0)
- macOS (playback uses `afplay`)

## Setup

```bash
git clone https://github.com/ChristianAlexa/yap.git
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

## Using it

Once the `speak` tool is registered, prompt Claude in plain English:

- **"yap that"** after a response — reads the previous reply aloud.
- **`yap: <text>`** — reads exactly what follows the colon, nothing else. Useful when you want a specific string spoken verbatim without Claude paraphrasing.
- **"yap that with `bf_emma`"** — same as above but overrides the default voice. Omit the voice name to use `KOKORO_DEFAULT_VOICE`.

Kokoros ships 54 voices; see the [Kokoros repo](https://github.com/lucasjinreal/Kokoros) for the full list of voice IDs.

## Verify it works

With Kokoros running on port 3000:

```bash
npm test                    # strip.js unit tests (11 cases)
node smoke.js               # happy path: plays audio, asserts shape
node smoke.js --dead-port   # asserts tts_unavailable when Kokoros is down
node smoke.js --double-call # asserts the single-flight busy lock
```

## Troubleshooting

**The `speak` tool doesn't appear in Claude Desktop.**
Check that the path in `claude_desktop_config.json` is absolute, then fully quit Claude Desktop with ⌘Q and relaunch — closing the window isn't enough. If it still doesn't show, check `~/Library/Logs/Claude/mcp-server-yap.log` for startup errors (and `~/Library/Logs/Claude/mcp.log` for the parent process view).

**Every call returns `{ error: "tts_unavailable" }`.**
Kokoros isn't reachable. Confirm it's running (`koko openai`) and that `KOKORO_URL` points at the right port. A quick check:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/v1/audio/speech \
  -H 'content-type: application/json' \
  -d '{"model":"tts-1","voice":"af_heart","input":"hi"}'
```

Anything other than `200` means Kokoros isn't serving — fix that before looking at `yap`.

**A call returns `{ error: "busy" }`.**
`yap` holds a single-flight lock across synthesis *and* playback, so only one `speak` call runs at a time. Wait for the current one to finish. This is intentional — overlapping calls are an edge case that doesn't happen in normal use.

**A call returns `{ error: "playback_failed" }`.**
`afplay` exited with a non-zero code. This can happen if the WAV file is corrupt, `/tmp` is not writable, or `afplay` is missing (unlikely on stock macOS). Check the `detail` field for the specific error.

**Claude keeps passing a `voice` you didn't ask for.**
The tool description in `index.js` tells Claude to omit `voice` unless the user explicitly asks. If you've edited the description, make sure that instruction survived — without it, Claude tends to pick a voice on its own and override `KOKORO_DEFAULT_VOICE`.
