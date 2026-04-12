# INSTALL.md — Claude Code playbook for installing yap

This file is a playbook for a coding agent (Claude Code or similar) to walk a user through installing yap. It is **not** a human tutorial — the human-facing guide lives in [`README.md`](./README.md).

**If you are the user:** from the yap repo root, run:
```
claude "follow INSTALL.md to install yap"
```

**If you are the agent:** work through the phases below in order. Announce which phase you are entering before each one, stop at every checkpoint, and do not skip ahead.

**Scope:** macOS only. If the user is on Linux or Windows, stop at Phase 1 and say so.

---

## Phase 1 — Prerequisites

Goal: confirm the environment can run yap at all.

1. Run `uname -s`. If the result is not `Darwin`, STOP and tell the user yap is macOS-only.
2. Confirm Claude Desktop is installed by checking that `~/Library/Application Support/Claude/` exists. If not, STOP and point the user at https://claude.ai/download.
3. Confirm the current directory is the yap repo root by checking for `index.js`, `package.json`, and `setup.sh`. If any are missing, ask the user to `cd` into their yap clone and restart.

**Checkpoint:** Say "Phase 1 complete: prerequisites verified." Do not proceed until all three checks pass.

---

## Phase 2 — Deterministic install

Goal: hand the boring parts off to `setup.sh` and read its output.

1. Run `bash setup.sh`. Stream output to the user as it runs.
2. Inspect the four checks the script reports: Node version, dependencies, unit tests, Kokoros reachability.
3. If Node or npm install failed (`✗`), STOP and diagnose before proceeding. Do not move on with a broken install.
4. Note whether the Kokoros check passed (`✓`) or warned (`!`). Remember this for Phase 4.
5. Capture the JSON snippet the script printed — you will need the exact absolute path it contains.

**Checkpoint:** Say "Phase 2 complete: dependencies installed and tests pass." If Kokoros was unreachable, add "Kokoros is not running — we'll fix that in Phase 4."

---

## Phase 3 — Register yap with Claude Desktop

Goal: merge the yap entry into `claude_desktop_config.json` **without clobbering** existing MCP servers.

1. Set `CONFIG_PATH="$HOME/Library/Application Support/Claude/claude_desktop_config.json"`.
2. If the file does not exist, create it with `{"mcpServers": {}}` and note that you did.
3. Read the current file and parse it as JSON. If parsing fails, STOP and ask the user whether to back up and start fresh — do not attempt a blind overwrite.
4. Check if `mcpServers.yap` already exists. If it does, show the existing value and ask the user whether to overwrite.
5. Add (or replace) the `yap` entry using the exact snippet `setup.sh` printed in Phase 2 — it already has the correct absolute path and the nvm-aware or plain-node wrapper as appropriate.
6. Preserve every other key in the file untouched. Do not reformat unrelated entries.
7. Write the merged JSON back with 2-space indentation.
8. Show the user a diff of the before/after so they can see exactly what changed.

**Checkpoint:** Say "Phase 3 complete: yap is registered. Here is the diff." Wait for the user to confirm the diff looks right before continuing.

---

## Phase 4 — Kokoros (skip if Phase 2 Kokoros check passed)

Goal: get the TTS engine running so `speak` calls actually produce audio.

1. Explain to the user: yap will return `{error: "tts_unavailable"}` on every call until Kokoros is running.
2. Point them at https://github.com/lucasjinreal/Kokoros for install instructions. Do **not** attempt to install Kokoros yourself — it is a Rust project with its own toolchain and model files, and is out of scope for this playbook.
3. Once they say it is installed, ask them to run `koko openai` in a **separate terminal** and leave it running.
4. Re-run the reachability probe:
   ```
   curl -fsS --max-time 2 -o /dev/null -X POST http://localhost:3000/v1/audio/speech \
     -H 'content-type: application/json' \
     -d '{"model":"tts-1","voice":"af_heart","input":"hi"}'
   ```
5. If the probe still fails, help diagnose: is `koko openai` actually running? Did it bind to a different port? Did the model files finish downloading? Ask the user to share the Kokoros process output.

**Checkpoint:** Say "Phase 4 complete: Kokoros is reachable." Do not proceed until the probe returns 200.

---

## Phase 5 — Activate and verify

Goal: get yap live in Claude Desktop and prove the full loop works.

1. Tell the user to fully quit Claude Desktop with **⌘Q** — closing the window is not enough. Wait for them to confirm they have done so.
2. Ask them to relaunch Claude Desktop.
3. Ask them to open a new conversation and type: `yap: installation complete`. If they hear audio, yap is working end-to-end.
4. If they hear nothing, read `~/Library/Logs/Claude/mcp-server-yap.log` for the startup error and diagnose from there. Common causes: wrong absolute path in the config, nvm wrapper failing because Node 20 is not installed via nvm, Kokoros died between Phase 4 and now.

**Checkpoint:** Say "Phase 5 complete: yap is installed and working." Point the user at the **Using it** section of `README.md` for prompt patterns like `yap that` and voice overrides.

---

## Rules for the agent

1. **Always announce the current phase** before you start running commands for it.
2. **Stop at every checkpoint.** Do not silently roll from one phase into the next.
3. **Never edit `claude_desktop_config.json` blindly.** Always show the diff before or after writing.
4. **Never install Kokoros yourself.** Defer to its repo.
5. **Never daemonize Kokoros or yap.** Both are foreground processes by design.
6. **If a phase fails, STOP and diagnose.** Do not retry the identical command and do not skip ahead.
