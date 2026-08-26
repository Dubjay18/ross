import { classifyLines } from "./lineClassifier.js";
import type { EventStream } from "./types.js";

/**
 * Plaintext has no markup guarantees — scene breaks, character cues, and
 * action are all inferred from line shape (see heuristics.ts). This will
 * misclassify occasionally; that's an accepted tradeoff for a hackathon,
 * not something to keep tuning.
 */
export function extractPlaintext(rawText: string): EventStream {
  const lines = rawText.split(/\r\n|\r|\n/);
  return classifyLines(lines, { fountainForcedSyntax: false });
}
