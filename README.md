# yap

Give Claude Desktop or Claude Code a voice. Ask it to read a response aloud and it does — using a local TTS engine.

Under the hood, yap is a tiny [MCP](https://modelcontextprotocol.io/) server that exposes a single `speak` tool. It strips markdown from the text, sends it to local [Kokoros](https://github.com/lucasjinreal/Kokoros), plays audio, and returns metadata. macOS-only.

## Prerequisites

- **macOS** (playback uses `afplay`)
- **Node ≥ 20.11**
- **[Kokoros](https://github.com/lucasjinreal/Kokoros)** reachable at `http://localhost:3000`

Install Kokoros from its repo, then run:

```bash
koko openai
```

## Quick Start

```bash
git clone https://github.com/ChristianAlexa/yap.git
cd yap
bash setup.sh
```

`setup.sh` installs dependencies, runs tests, checks Kokoros reachability, and prints the exact Claude Desktop config snippet for your machine.

> Using Claude Code? [`INSTALL.md`](./INSTALL.md) is an agent playbook that walks you through the same setup interactively — `claude "follow INSTALL.md to install yap"`.

Add that `yap` entry to `~/Library/Application Support/Claude/claude_desktop_config.json`.

If you prefer manual setup, use:

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

> **Using nvm?** Node installed via nvm isn't visible to Claude Desktop's spawned process. Use:
> ```json
> "command": "bash",
> "args": ["-c", "source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && node /absolute/path/to/yap/index.js"]
> ```

Fully quit and relaunch Claude Desktop (⌘Q — not just closing the window). The `speak` tool will appear in the tool panel.

### Claude Code (optional)

Claude Code uses a separate MCP config from Claude Desktop. To register `yap` for all Claude Code sessions, run:

```bash
claude mcp add yap -s user \
  -e KOKORO_URL=http://localhost:3000 \
  -e KOKORO_DEFAULT_VOICE=af_heart \
  -- node /absolute/path/to/yap/index.js
```

If your Node install is managed by nvm, use this command form instead:

```bash
claude mcp add yap -s user \
  -e KOKORO_URL=http://localhost:3000 \
  -e KOKORO_DEFAULT_VOICE=af_heart \
  -- bash -c 'source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && node /absolute/path/to/yap/index.js'
```

Verify registration with:

```bash
claude mcp list
```

## Using it

Once the `speak` tool is registered, prompt Claude in plain English:

- **"yap that"** after a response — reads the previous reply aloud.
- **`yap: <text>`** — reads exactly what follows the colon, nothing else. Useful when you want a specific string spoken verbatim without Claude paraphrasing.
- **"yap that with `bf_emma`"** — same as above but overrides the default voice. Omit the voice name to use `KOKORO_DEFAULT_VOICE`.

Kokoros ships 54 voices; see the [Kokoros repo](https://github.com/lucasjinreal/Kokoros) for the full list of voice IDs.

## Verify it works

```bash
npm test                    # strip.js unit tests (11 cases) — no Kokoros needed
node smoke.js               # happy path: plays audio (requires Kokoros running)
node smoke.js --dead-port   # asserts tts_unavailable (deliberately points at a closed port)
node smoke.js --empty-input # asserts empty_input when the text strips to "" (no Kokoros call)
node smoke.js --double-call # asserts the single-flight busy lock (requires Kokoros)
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

**A call returns `{ error: "empty_input" }`.**
The text was empty after markdown stripping — usually because the input was entirely a fenced code block. Send some prose alongside it.

**A call returns `{ error: "write_failed" }`.**
yap couldn't write the temp WAV file to `/tmp`. Check disk space and `/tmp` permissions. The `detail` field has the specific OS error.

**A call returns `{ error: "playback_failed" }`.**
`afplay` exited with a non-zero code. This can happen if the WAV file is corrupt or `afplay` is missing (unlikely on stock macOS). Check the `detail` field for the specific error.

**A `speak` call hangs without returning.**
Kokoros may be deadlocked. Restart it via `make restart` or re-run `koko openai`. Mostly informational: `fetch` now times out at 30s and returns `tts_unavailable`, so the call will eventually come back on its own — but a Kokoros restart is the fix.

**A call times out on very long text.**
`speak` blocks until playback finishes, so a 30-second response is a 30-second tool call. If Claude Desktop's MCP timeout is shorter than synthesis + playback, the call is cut off before it returns. Try shorter passages, or raise the timeout in `claude_desktop_config.json`.

**Claude keeps passing a `voice` you didn't ask for.**
The tool description in `index.js` tells Claude to omit `voice` unless the user explicitly asks. If you've edited the description, make sure that instruction survived — without it, Claude tends to pick a voice on its own and override `KOKORO_DEFAULT_VOICE`.

## Licenses

- **yap** — MIT (see [LICENSE](LICENSE))
- **Kokoros** — separately installed, see its [repo](https://github.com/lucasjinreal/Kokoros) for terms
- **Kokoro-82M model** — Apache 2.0, distributed with Kokoros ([model card](https://huggingface.co/hexgrad/Kokoro-82M))
