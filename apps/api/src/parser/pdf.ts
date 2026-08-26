import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
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

// Pre-flight sanity gate before any per-page work runs — cheap (numPages is
// available immediately after the document loads, no text extraction yet).
// The authoritative size limit is MAX_SCRIPT_CHARS, enforced character-by-
// character in buildIndex() as events stream in; this just avoids spinning
// up pdf.js's per-page pipeline for something absurdly oversized.
const PDF_PAGE_HARD_CAP = 600;

// Character cues sit well to the right of the action/scene-heading margin in
// standard screenplay PDF export; dialogue is indented less than a cue but
// more than action. These are relative offsets from the page's own inferred
// left margin (not absolute inches) so it tolerates different page sizes.
const CHARACTER_CUE_MIN_INDENT = 60;
const DIALOGUE_MIN_INDENT = 20;

interface TextItemLike {
  str: string;
  transform: number[];
}

interface Row {
  x: number;
  text: string;
}

/**
 * PDF text carries no element-type markup — only position. This clusters
 * text into rows by y-coordinate, then classifies each row by a mix of the
 * same shape heuristics used for plaintext (heuristics.ts) and left-indent
 * relative to the page's inferred margin. Best-effort by design: real-world
 * screenplay PDFs (scanned-then-OCR'd, unusual margins, two-column inserts)
 * will misclassify sometimes — not worth chasing further for a hackathon.
 *
 * Chunked per page: each page is extracted and classified, then control is
 * yielded back to the event loop before the next page, so a large PDF
 * doesn't block the API for the whole document in one synchronous stretch.
 */
export async function* extractPdf(data: Uint8Array): EventStream {
  const loadingTask = getDocument({ data });
  try {
    const doc = await loadingTask.promise;

    if (doc.numPages > PDF_PAGE_HARD_CAP) {
      throw new Error(
        `PDF has ${doc.numPages} pages, exceeding the ${PDF_PAGE_HARD_CAP}-page sanity limit`,
      );
    }

    let currentCharacterPending = false;

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const rows = groupIntoRows(content.items as TextItemLike[]);
      const leftMargin = estimateLeftMargin(rows);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const trimmed = row?.text.trim() ?? "";
        if (!trimmed) continue;

        const indent = (row?.x ?? 0) - leftMargin;

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

        if (indent > CHARACTER_CUE_MIN_INDENT && isLikelyCharacterCue(trimmed, rows[i + 1]?.text)) {
          yield { kind: "character", name: extractCharacterName(trimmed) };
          currentCharacterPending = true;
          continue;
        }

        if (currentCharacterPending && indent > DIALOGUE_MIN_INDENT) {
          yield { kind: "line", type: "dialogue", text: trimmed };
          continue;
        }

        currentCharacterPending = false;
        yield { kind: "line", type: "action", text: trimmed };
      }

      page.cleanup();
      await yieldToEventLoop();
    }
  } finally {
    await loadingTask.destroy();
  }
}

function groupIntoRows(items: TextItemLike[]): Row[] {
  const rowsByY = new Map<number, { x: number; parts: { x: number; text: string }[] }>();

  for (const item of items) {
    if (!item.str) continue;
    const x = item.transform[4] ?? 0;
    const y = Math.round(item.transform[5] ?? 0);
    const bucket = rowsByY.get(y) ?? { x, parts: [] };
    bucket.parts.push({ x, text: item.str });
    bucket.x = Math.min(bucket.x, x);
    rowsByY.set(y, bucket);
  }

  return Array.from(rowsByY.entries())
    .sort((a, b) => b[0] - a[0]) // PDF y grows upward — descending y = reading order
    .map(([, bucket]) => ({
      x: bucket.x,
      text: bucket.parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.text)
        .join(""),
    }));
}

function estimateLeftMargin(rows: Row[]): number {
  if (rows.length === 0) return 0;
  const xs = rows.map((r) => r.x).sort((a, b) => a - b);
  // Action/scene-heading text defines the leftmost column in standard
  // screenplay format — nothing legitimate sits further left than it, so
  // the true margin is a lower bound, not a central tendency. Use a low
  // percentile rather than the strict minimum so one or two stray
  // further-left artifacts (page numbers, headers) don't skew it.
  const idx = Math.floor(xs.length * 0.1);
  return xs[idx] ?? xs[0] ?? 0;
}
