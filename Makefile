# yap — convenience targets for managing the Kokoros launchd service
# and running the test suite. All launchd targets are macOS-only.

KOKOROS_DIR    ?= $(HOME)/dev/Kokoros
LABEL          := com.yap.kokoros
PLIST_TEMPLATE := com.yap.kokoros.plist.template
PLIST_DEST     := $(HOME)/Library/LaunchAgents/$(LABEL).plist
KOKORO_URL     ?= http://localhost:3000

.PHONY: help install uninstall start stop restart status logs test smoke smoke-dead smoke-empty smoke-double

help:
	@echo "yap Makefile targets:"
	@echo ""
	@echo "  Service management (Kokoros via launchd):"
	@echo "    make install      Render plist from template and load it (KOKOROS_DIR=$(KOKOROS_DIR))"
	@echo "    make uninstall    Unload and remove the plist"
	@echo "    make start        Load the plist (starts Kokoros now + on every login)"
	@echo "    make stop         Unload the plist (stops Kokoros, no auto-restart)"
	@echo "    make restart      Kickstart — fastest way to bounce the process"
	@echo "    make status       Show launchd state + probe $(KOKORO_URL)"
	@echo "    make logs         Tail /tmp/kokoros.err (Ctrl-C to exit)"
	@echo ""
	@echo "  Tests:"
	@echo "    make test         Unit tests (strip.js)"
	@echo "    make smoke        End-to-end smoke test (requires Kokoros running)"
	@echo "    make smoke-dead   Smoke test with dead Kokoros (expects tts_unavailable)"
	@echo "    make smoke-empty  Smoke test empty-after-stripping input (expects empty_input)"
	@echo "    make smoke-double Smoke test the single-flight busy lock"

install:
	@if [ ! -x "$(KOKOROS_DIR)/target/release/koko" ]; then \
		echo "✗ Kokoros binary not found at $(KOKOROS_DIR)/target/release/koko"; \
		echo "  Set KOKOROS_DIR, e.g.: make install KOKOROS_DIR=/path/to/Kokoros"; \
		exit 1; \
	fi
	@sed 's|@@KOKOROS_DIR@@|$(KOKOROS_DIR)|g' $(PLIST_TEMPLATE) > $(PLIST_DEST)
	@launchctl load $(PLIST_DEST)
	@echo "✓ Installed and loaded $(LABEL)"
	@echo "  Plist: $(PLIST_DEST)"
	@echo "  Run 'make status' to verify."

uninstall:
	@launchctl unload $(PLIST_DEST) 2>/dev/null || true
	@rm -f $(PLIST_DEST)
	@echo "✓ Uninstalled $(LABEL)"

start:
	@launchctl load $(PLIST_DEST)
	@echo "✓ Started $(LABEL)"

stop:
	@launchctl unload $(PLIST_DEST)
	@echo "✓ Stopped $(LABEL)"

restart:
	@launchctl kickstart -k gui/$$(id -u)/$(LABEL)
	@echo "✓ Restarted $(LABEL)"

status:
	@echo "launchd:"
	@launchctl list | grep $(LABEL) || echo "  (not loaded)"
	@echo ""
	@echo "HTTP probe ($(KOKORO_URL)):"
	@curl -fsS --max-time 3 -o /dev/null -w "  http=%{http_code} connect=%{time_connect}s total=%{time_total}s\n" \
		-X POST $(KOKORO_URL)/v1/audio/speech \
		-H 'content-type: application/json' \
		-d '{"model":"tts-1","voice":"af_heart","input":"hi"}' \
		|| echo "  (unreachable)"

logs:
	@tail -f /tmp/kokoros.err

test:
	@npm test

smoke:
	@node smoke.js

smoke-dead:
	@node smoke.js --dead-port

smoke-empty:
	@node smoke.js --empty-input

smoke-double:
	@node smoke.js --double-call
