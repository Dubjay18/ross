import { classifyLines } from "./lineClassifier.js";
import type { EventStream } from "./types.js";

/**
 * Fountain (https://fountain.io/syntax) — same shape-based classification as
 * plaintext, plus recognition of Fountain's forced-element prefixes
 * ("." scene heading, "@" character, ">" transition), which resolve
 * ambiguous cases the plaintext heuristic can't.
 */
export function extractFountain(rawText: string): EventStream {
  const lines = rawText.split(/\r\n|\r|\n/);
  return classifyLines(lines, { fountainForcedSyntax: true });
}
