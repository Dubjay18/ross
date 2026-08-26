import { XMLParser } from "fast-xml-parser";
import { parseSceneHeading } from "./heuristics.js";
import type { EventStream, ParsedLineType } from "./types.js";
import { yieldToEventLoop } from "./types.js";

const TYPE_MAP: Record<string, ParsedLineType | "scene" | "character"> = {
  "Scene Heading": "scene",
  Action: "action",
  Character: "character",
  Dialogue: "dialogue",
  Parenthetical: "parenthetical",
  Transition: "transition",
  Shot: "action",
  General: "action",
};

const BATCH_SIZE = 300;

interface FdxTextRun {
  "#text"?: string;
}

interface FdxParagraph {
  "@_Type"?: string;
  Text?: FdxTextRun | string | (FdxTextRun | string)[];
}

/**
 * Final Draft (.fdx) — XML with an explicit `Type` per paragraph, so this is
 * a direct mapping rather than a heuristic (unlike plaintext/PDF). No
 * chunking needed: FDX files are XML text, typically far smaller than an
 * equivalent PDF for the same script — a streaming/SAX parser would add
 * complexity for no measurable benefit here.
 */
export async function* extractFdx(xml: string): EventStream {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) => name === "Paragraph" || name === "Text",
  });

  const doc = parser.parse(xml) as {
    FinalDraft?: { Content?: { Paragraph?: FdxParagraph[] } };
  };
  const paragraphs = doc.FinalDraft?.Content?.Paragraph ?? [];

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const type = paragraph?.["@_Type"] ?? "";
    const text = extractParagraphText(paragraph);
    if (!text) continue;

    const mapped = TYPE_MAP[type] ?? "action";

    if (mapped === "scene") {
      yield { kind: "scene", ...parseSceneHeading(text) };
    } else if (mapped === "character") {
      yield { kind: "character", name: text.replace(/\(.*?\)/g, "").trim() };
    } else {
      yield { kind: "line", type: mapped, text };
    }

    if ((i + 1) % BATCH_SIZE === 0) {
      await yieldToEventLoop();
    }
  }
}

function extractParagraphText(paragraph: FdxParagraph | undefined): string {
  const texts = paragraph?.Text;
  if (!texts) return "";
  const list = Array.isArray(texts) ? texts : [texts];
  return list
    .map((run) => (typeof run === "string" ? run : (run["#text"] ?? "")))
    .join("")
    .trim();
}
