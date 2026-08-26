/**
 * Screenplay-element classification heuristics shared by the plaintext and
 * Fountain extractors (and reused for scene-heading/character-cue
 * disambiguation in the PDF extractor). Best-effort by design — screenplay
 * formatting in the wild is inconsistent; document known gaps in comments
 * rather than chasing every edge case.
 */

const SCENE_HEADING_RE = /^(int\.?\/ext\.?|i\/e|int\.?|ext\.?)\b/i;
const TRANSITION_RE = /(CUT TO|FADE (IN|OUT)|DISSOLVE TO|SMASH CUT TO)[:.]?$/i;

export function isSceneHeading(line: string): boolean {
  return SCENE_HEADING_RE.test(line.trim());
}

export function parseSceneHeading(line: string): {
  heading: string;
  location: string | null;
  timeOfDay: "INT" | "EXT" | null;
} {
  const trimmed = line.trim();
  const upper = trimmed.toUpperCase();

  let timeOfDay: "INT" | "EXT" | null = null;
  if (/^(INT\.?\/EXT\.?|I\/E)\b/.test(upper)) {
    timeOfDay = null; // genuinely ambiguous — both, not forced either way
  } else if (/^INT\b/.test(upper)) {
    timeOfDay = "INT";
  } else if (/^EXT\b/.test(upper)) {
    timeOfDay = "EXT";
  }

  const withoutPrefix = trimmed.replace(/^(int\.?\/ext\.?|i\/e|int\.?|ext\.?)\s*[.\-]?\s*/i, "");
  const location = withoutPrefix.split(/\s+-\s+/)[0]?.trim() || null;

  return { heading: trimmed, location, timeOfDay };
}

export function isLikelyCharacterCue(line: string, nextLine: string | undefined): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 40) return false;
  if (isSceneHeading(trimmed)) return false;

  const letters = trimmed.replace(/[^A-Za-z]/g, "");
  if (!letters || letters !== letters.toUpperCase()) return false;

  // A character cue must be followed by something (dialogue or a
  // parenthetical) — an all-caps line with nothing after it is more likely
  // an action beat emphasis or a stray heading.
  return Boolean(nextLine && nextLine.trim());
}

export function extractCharacterName(cueLine: string): string {
  return cueLine.trim().replace(/\(.*?\)/g, "").trim();
}

export function isParenthetical(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("(") && trimmed.endsWith(")");
}

export function isTransition(line: string): boolean {
  const trimmed = line.trim();
  return trimmed === trimmed.toUpperCase() && TRANSITION_RE.test(trimmed);
}
