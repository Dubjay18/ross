import {
  extractCharacterName,
  isLikelyCharacterCue,
  isParenthetical,
  isSceneHeading,
  isTransition,
  parseSceneHeading,
} from "./heuristics.js";
import type { EventStream } from "./types.js";
import { yieldToEventLoop } from "./types.js";

const BATCH_SIZE = 500;

export interface ClassifyOptions {
  /** Fountain forced-syntax overrides — plaintext has none of these. */
  fountainForcedSyntax?: boolean;
}

/**
 * Shared line-by-line classifier for plaintext and Fountain input (both are
 * "unstructured text, infer element type from shape" formats — PDF and FDX
 * have their own extractors since they carry real structural signal).
 *
 * Processes in batches of BATCH_SIZE lines with a cooperative yield between
 * batches so a very large script doesn't block the event loop for the whole
 * parse in one synchronous stretch.
 */
export async function* classifyLines(
  lines: string[],
  options: ClassifyOptions = {},
): EventStream {
  let currentCharacterPending = false;

  for (let batchStart = 0; batchStart < lines.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, lines.length);

    for (let i = batchStart; i < batchEnd; i++) {
      const raw = lines[i] ?? "";
      const trimmed = raw.trim();
      if (!trimmed) {
        // A blank line ends a dialogue block per screenplay convention —
        // whatever follows (until the next character cue) is action, not
        // a continuation of the same character's dialogue.
        currentCharacterPending = false;
        continue;
      }

      if (options.fountainForcedSyntax && trimmed.startsWith(".") && !trimmed.startsWith("..")) {
        const heading = trimmed.slice(1);
        yield { kind: "scene", ...parseSceneHeadingSafe(heading) };
        currentCharacterPending = false;
        continue;
      }

      if (options.fountainForcedSyntax && trimmed.startsWith("@")) {
        yield { kind: "character", name: extractCharacterName(trimmed.slice(1)) };
        currentCharacterPending = true;
        continue;
      }

      if (options.fountainForcedSyntax && trimmed.startsWith(">") && !trimmed.startsWith(">>")) {
        yield { kind: "line", type: "transition", text: trimmed.slice(1).replace(/<$/, "").trim() };
        continue;
      }

      if (isSceneHeading(trimmed)) {
        yield { kind: "scene", ...parseSceneHeading(trimmed) };
        currentCharacterPending = false;
        continue;
      }

      if (isTransition(trimmed)) {
        yield { kind: "line", type: "transition", text: trimmed };
        continue;
      }

      if (isParenthetical(trimmed)) {
        yield { kind: "line", type: "parenthetical", text: trimmed };
        continue;
      }

      if (isLikelyCharacterCue(trimmed, lines[i + 1])) {
        yield { kind: "character", name: extractCharacterName(trimmed) };
        currentCharacterPending = true;
        continue;
      }

      if (currentCharacterPending) {
        yield { kind: "line", type: "dialogue", text: trimmed };
        continue;
      }

      yield { kind: "line", type: "action", text: trimmed };
    }

    if (batchEnd < lines.length) {
      await yieldToEventLoop();
    }
  }
}

function parseSceneHeadingSafe(heading: string) {
  const trimmed = heading.trim();
  if (isSceneHeading(trimmed)) return parseSceneHeading(trimmed);
  // Forced scene heading (".") with no INT/EXT prefix — still a scene break,
  // just no time-of-day/location signal to extract.
  return { heading: trimmed, location: null, timeOfDay: null };
}
