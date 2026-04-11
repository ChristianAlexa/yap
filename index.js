import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Phase 1 stub. Phase 3 will:
//   - strip markdown from text
//   - POST to Kokoros, play via afplay
//   - replace char_count with stripped.length
//   - replace stripped_text with the actual stripped output
//   - measure duration_ms from afplay spawn -> exit
// The stub: true / note fields exist so Claude (the model) stops narrating
// "read aloud" over a handler that hasn't synthesized anything. Phase 3
// deletes these two fields when real audio ships.
export async function speak({ text, voice }) {
  const chosenVoice = voice ?? process.env.KOKORO_DEFAULT_VOICE ?? "af_heart";
  return {
    voice: chosenVoice,
    duration_ms: 0,
    char_count: text.length,
    stripped_text: text,
    stub: true,
    note: "Phase 1 placeholder — no synthesis or playback yet. Do not claim audio was played.",
  };
}

const server = new McpServer({
  name: "yap",
  version: "0.1.0",
});

server.registerTool(
  "speak",
  {
    description:
      "Read text aloud using the local Kokoros TTS service. Strips markdown before synthesis.",
    inputSchema: {
      text: z.string().describe("The text to read aloud."),
      voice: z
        .string()
        .optional()
        .describe("Kokoro voicepack ID (e.g. af_heart, am_adam)."),
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
