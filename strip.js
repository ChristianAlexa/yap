// Pure markdown -> plain-text stripper for TTS input.
// Not a full markdown parser — just enough that Kokoro doesn't read
// literal `**`, `#`, backticks, etc. aloud. Exposed as a pure function
// so future callers can reuse or bypass it.

export function stripMarkdown(text) {
  let out = text;

  // --- Pass 1: block-level constructs. Remove as whole units so their
  // contents don't get processed by the line-level pass below.

  // Fenced code blocks (``` or ~~~). Non-greedy across lines.
  out = out.replace(/```[^\n]*\n[\s\S]*?\n[ \t]*```[ \t]*/g, "");
  out = out.replace(/~~~[^\n]*\n[\s\S]*?\n[ \t]*~~~[ \t]*/g, "");

  // Block quote markers: strip "> " prefix, keep the quoted text.
  out = out.replace(/^[ \t]*>[ \t]?/gm, "");

  // --- Pass 2: line-level markers.

  // Horizontal rules (---, ***, ___).
  out = out.replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, "");

  // ATX headings: leading # (1-6). Strip marker, keep the heading text.
  out = out.replace(/^[ \t]*#{1,6}[ \t]+/gm, "");

  // Images (must run before links — images are a superset): ![alt](url) -> alt
  out = out.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");

  // Links: [text](url) -> text
  out = out.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

  // Bold / italic. Longest delimiters first so ** isn't eaten by *.
  out = out.replace(/\*\*\*([^*\n]+?)\*\*\*/g, "$1");
  out = out.replace(/___([^_\n]+?)___/g, "$1");
  out = out.replace(/\*\*([^*\n]+?)\*\*/g, "$1");
  out = out.replace(/__([^_\n]+?)__/g, "$1");
  out = out.replace(/\*([^*\n]+?)\*/g, "$1");
  // Underscore italic only applies at word boundaries — so snake_case
  // identifiers are preserved intact.
  out = out.replace(/(^|\W)_([^_\n]+?)_(?=\W|$)/g, "$1$2");

  // Inline code: `x` -> x
  out = out.replace(/`([^`]*)`/g, "$1");

  // Bulleted list markers (-, *, +) at line start.
  out = out.replace(/^[ \t]*[-*+][ \t]+/gm, "");

  // Numbered list markers (1. 2. etc.) at line start.
  out = out.replace(/^[ \t]*\d+\.[ \t]+/gm, "");

  // Collapse runs of blank lines left behind by block removal.
  out = out.replace(/\n{3,}/g, "\n\n");

  return out.trim();
}
