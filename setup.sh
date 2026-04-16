#!/usr/bin/env bash
# yap setup — installs deps, verifies prereqs, prints your Claude Desktop config.
#
# Run from anywhere:
#   bash /path/to/yap/setup.sh
#
# Deliberately does NOT:
#   - install Kokoros (separate Rust project — handled by its own repo)
#   - start any background services
#   - auto-merge claude_desktop_config.json (would risk clobbering other MCP servers)

set -euo pipefail

# Resolve the yap directory from the script location, not cwd.
YAP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$YAP_DIR"

# TTY colors, plain output if piped.
if [[ -t 1 ]]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RESET=$'\033[0m'
else
  BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; RESET=""
fi

ok()   { echo "${GREEN}✓${RESET} $1"; }
warn() { echo "${YELLOW}!${RESET} $1"; }
fail() { echo "${RED}✗${RESET} $1" >&2; }

echo "${BOLD}yap setup${RESET}"
echo

# --- 1. Node version check -------------------------------------------------
# Source nvm if present so this works in non-interactive shells too.
HAS_NVM=0
if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  source "$HOME/.nvm/nvm.sh"
  HAS_NVM=1
fi

if ! command -v node >/dev/null 2>&1; then
  fail "node not found on PATH. Install Node 20.11+ (e.g. via nvm) and rerun."
  exit 1
fi

NODE_VERSION=$(node --version | sed 's/^v//')
NODE_MAJOR=${NODE_VERSION%%.*}
NODE_MINOR=$(echo "$NODE_VERSION" | cut -d. -f2)

if (( NODE_MAJOR < 20 )) || { (( NODE_MAJOR == 20 )) && (( NODE_MINOR < 11 )); }; then
  fail "Node $NODE_VERSION is too old. yap needs 20.11+ (stable node:test + global fetch)."
  exit 1
fi
ok "Node $NODE_VERSION"

# --- 2. npm install --------------------------------------------------------
echo "Installing dependencies…"
npm install --silent
ok "Dependencies installed"

# --- 3. Unit tests ---------------------------------------------------------
if npm test --silent >/dev/null 2>&1; then
  ok "Unit tests pass"
else
  warn "Unit tests failed — run ${BOLD}npm test${RESET} to see details."
fi

# --- 4. Kokoros reachability check -----------------------------------------
KOKORO_URL="${KOKORO_URL:-http://localhost:3000}"
if curl -fsS --max-time 2 -o /dev/null \
    -X POST "$KOKORO_URL/v1/audio/speech" \
    -H 'content-type: application/json' \
    -d '{"model":"tts-1","voice":"af_heart","input":"hi"}' 2>/dev/null; then
  ok "Kokoros is reachable at $KOKORO_URL"
  KOKORO_OK=1
else
  warn "Kokoros is NOT reachable at $KOKORO_URL"
  echo "   yap will return {error:\"tts_unavailable\"} until Kokoros is running."
  echo "   Install it from ${BOLD}https://github.com/lucasjinreal/Kokoros${RESET}, then run: ${BOLD}koko openai${RESET}"
  KOKORO_OK=0
fi

# --- 5. Config snippet -----------------------------------------------------
CONFIG_PATH="$HOME/Library/Application Support/Claude/claude_desktop_config.json"

echo
echo "${BOLD}Next step:${RESET} add this to ${DIM}$CONFIG_PATH${RESET}"
echo

if (( HAS_NVM == 1 )); then
  # nvm-aware wrapper — avoids the recursive-shell issue and pins Node 20.
  cat <<JSON
{
  "mcpServers": {
    "yap": {
      "command": "bash",
      "args": [
        "-c",
        "source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && node $YAP_DIR/index.js"
      ],
      "env": {
        "KOKORO_URL": "http://localhost:3000",
        "KOKORO_DEFAULT_VOICE": "af_heart"
      }
    }
  }
}
JSON
else
  # No nvm detected — invoke node directly with its current absolute path.
  NODE_BIN="$(command -v node)"
  cat <<JSON
{
  "mcpServers": {
    "yap": {
      "command": "$NODE_BIN",
      "args": ["$YAP_DIR/index.js"],
      "env": {
        "KOKORO_URL": "http://localhost:3000",
        "KOKORO_DEFAULT_VOICE": "af_heart"
      }
    }
  }
}
JSON
fi

echo
if [[ -f "$CONFIG_PATH" ]]; then
  warn "${BOLD}$CONFIG_PATH${RESET} already exists."
  echo "   Merge the ${BOLD}yap${RESET} entry into your existing ${BOLD}mcpServers${RESET} object — do not overwrite the file."
fi

echo
echo "Then fully quit Claude Desktop with ${BOLD}⌘Q${RESET} and relaunch. The ${BOLD}speak${RESET} tool will appear automatically."

# --- 6. Claude Code registration (optional) --------------------------------
# Separate from Claude Desktop: different product, different config store.
# Claude Code ships a CLI (`claude mcp add`) that edits its own config safely,
# so we can offer a one-command registration instead of a JSON-merge dance.
if command -v claude >/dev/null 2>&1; then
  echo
  echo "${BOLD}Claude Code detected${RESET} — optional second install target."
  echo
  echo "Claude Code is a separate product from Claude Desktop with its own MCP"
  echo "config. Registering here makes the ${BOLD}speak${RESET} tool callable from any"
  echo "Claude Code session (terminal, IDE extension), not just Claude Desktop."

  if (( HAS_NVM == 1 )); then
    CC_COMMAND="bash"
    CC_INNER="source ~/.nvm/nvm.sh && nvm use 20 > /dev/null && node $YAP_DIR/index.js"
    CC_ARGS=(-c "$CC_INNER")
    CC_DISPLAY="bash -c '$CC_INNER'"
  else
    CC_COMMAND="${NODE_BIN:-$(command -v node)}"
    CC_ARGS=("$YAP_DIR/index.js")
    CC_DISPLAY="$CC_COMMAND $YAP_DIR/index.js"
  fi

  if claude mcp list 2>/dev/null | grep -q "^yap:"; then
    echo
    ok "yap is already registered with Claude Code — nothing to do."
  else
    echo
    echo "This will run (user scope, so it works in every Claude Code session):"
    echo "  ${DIM}claude mcp add yap -s user \\${RESET}"
    echo "  ${DIM}  -e KOKORO_URL=http://localhost:3000 \\${RESET}"
    echo "  ${DIM}  -e KOKORO_DEFAULT_VOICE=af_heart \\${RESET}"
    echo "  ${DIM}  -- $CC_DISPLAY${RESET}"
    echo
    if [[ -t 0 ]]; then
      read -r -p "Register yap with Claude Code? [y/N] " REPLY
      if [[ "$REPLY" =~ ^[Yy]$ ]]; then
        # Name before -e so commander's variadic -e doesn't swallow it.
        if claude mcp add yap -s user \
             -e KOKORO_URL=http://localhost:3000 \
             -e KOKORO_DEFAULT_VOICE=af_heart \
             -- "$CC_COMMAND" "${CC_ARGS[@]}"; then
          ok "Registered with Claude Code. Start a new Claude Code session to pick it up."
        else
          fail "Claude Code registration failed — see error above."
        fi
      else
        echo "Skipped. Run the command above later if you change your mind."
      fi
    else
      warn "Non-interactive shell — skipping prompt. Run the command above to register."
    fi
  fi
fi

if (( KOKORO_OK == 0 )); then
  echo
  echo "${YELLOW}Reminder:${RESET} yap needs Kokoros running to actually synthesize audio."
fi
