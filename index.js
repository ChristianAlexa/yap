import { spawn } from "node:child_process";
import fs from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { stripMarkdown } from "./strip.js";

// Coarse single-flight lock: covers synthesis + playback together.
// Concurrent synth with serialized playback is complexity for an edge case
// that doesn't happen in practice.
let playing = false;

export async function speak({ text, voice }) {
  if (playing) return { error: "busy", detail: "playback in progress" };
  playing = true;
  try {
    const chosenVoice = voice ?? process.env.KOKORO_DEFAULT_VOICE ?? "af_heart";
    const kokoroUrl = process.env.KOKORO_URL ?? "http://localhost:3000";
    const stripped = stripMarkdown(text);

    if (stripped.length === 0) {
      return { error: "empty_input", detail: "text is empty after markdown stripping" };
    }

    let response;
    try {
      response = await fetch(`${kokoroUrl}/v1/audio/speech`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: "tts-1", voice: chosenVoice, input: stripped }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      return { error: "tts_unavailable", detail: err.message };
    }
    if (!response.ok) {
      return { error: "tts_unavailable", detail: `HTTP ${response.status}` };
    }

    const tempPath = `/tmp/yap_${Date.now()}.wav`;
    try {
      await fs.promises.writeFile(tempPath, Buffer.from(await response.arrayBuffer()));
    } catch (err) {
      return { error: "write_failed", detail: err.message };
    }

    let duration_ms = 0;
    try {
      // Clock starts at spawn so duration_ms is playback only — not synth + playback.
      const start = Date.now();
      const child = spawn("afplay", [tempPath], { stdio: "ignore" });
      await new Promise((resolve, reject) => {
        child.on("exit", (code) =>
          code === 0 ? resolve() : reject(new Error(`afplay exited ${code}`)),
        );
        child.on("error", reject);
      });
      duration_ms = Date.now() - start;
    } catch (err) {
      return { error: "playback_failed", detail: err.message };
    } finally {
      await fs.promises.unlink(tempPath).catch(() => {});
    }

    return {
      voice: chosenVoice,
      duration_ms,
      char_count: stripped.length,
      stripped_text: stripped,
    };
  } finally {
    playing = false;
  }
}

const server = new McpServer({
  name: "yap",
  version: "0.1.0",
});

server.registerTool(
  "speak",
  {
    description:
      "Read text aloud using the local Kokoros TTS service. Strips markdown before synthesis. Omit `voice` unless the user explicitly requests a specific voice — the server has a configured default. If the user says \"yap less\" (or similar: \"yap the tldr\", \"yap short\"), pass a one-sentence summary of the prior response as `text` rather than the full reply.",
    inputSchema: {
      text: z.string().describe("The text to read aloud."),
      voice: z
        .string()
        .optional()
        .describe(
          "Optional Kokoro voicepack ID. Leave unset to use the configured default. Only set when the user explicitly asks for a specific voice (e.g. 'use bf_emma').",
        ),
    },
  },
  async (args) => {
    const result = await speak(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  },
);

// Only start the stdio server when run directly — not when imported by smoke.js
// or strip.test.js. Node sets process.argv[1] to the entrypoint path.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr is safe; stdout is reserved for JSON-RPC framing.
  console.error("yap MCP server running on stdio");
}
