# yap

Give Claude Desktop a voice. Ask it to read a response aloud and it does — using a local TTS engine, no cloud API, nothing leaves your machine.

Under the hood, yap is a tiny [MCP](https://modelcontextprotocol.io/) server that exposes a single `speak` tool. It strips markdown from the text, sends it to a local [Kokoros](https://github.com/lucasjinreal/Kokoros) TTS service, plays the audio, and returns metadata. One file, stdio transport, macOS-only.

## Prerequisites

- **macOS** (playback uses `afplay`)
- **Node ≥ 20.11**
- **[Kokoros](https://github.com/lucasjinreal/Kokoros)** running on `localhost:3000` — the local TTS engine that does the actual speech synthesis, using the [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) model (Apache 2.0)

<details>
<summary>Installing Kokoros (if you haven't already)</summary>

Kokoros is a standalone Rust binary. The short version for macOS:

```bash
brew install pkg-config opus
git clone https://github.com/lucasjinreal/Kokoros.git
cd Kokoros
bash download_all.sh        # downloads the ONNX model + voice data
cargo build --release
sudo bash install.sh        # copies koko to /usr/local/bin
```

Then start the TTS server:

```bash
koko openai                 # binds 0.0.0.0:3000
```

See the [Kokoros README](https://github.com/lucasjinreal/Kokoros) for full details, Linux instructions, and troubleshooting.

</details>

## Setup

```bash
git clone https://github.com/ChristianAlexa/yap.git
cd yap
npm install
```

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` — **replace `/absolute/path/to/yap` with the actual path** where you cloned the repo:

```json
{
  "mcpServers": {
    "yap": {
      "command": "node",
      "args": ["/absolute/path/to/yap/index.js"],
      "env": {
        "KOKORO_URL": "http://localhost:3000",
        "KOKORO_DEFAULT_VOICE": "af_heart"
      }
    }
  }
}
```

> **Using nvm?** Node installed via nvm isn't visible to Claude Desktop's spawned process. Replace the config above with:
> ```json
> "command": "bash",
> "args": ["-c", "source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && node /absolute/path/to/yap/index.js"]
> ```

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
