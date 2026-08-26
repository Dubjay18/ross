import { randomUUID } from "node:crypto";
import {
  MAX_LINES_PER_SCENE,
  MAX_SCENES_PER_SCRIPT,
  MAX_SCRIPT_CHARS,
  type Character,
  type Line,
  type Scene,
  type ScriptFormat,
} from "@ross/shared";
import { extractFdx } from "./fdx.js";
import { extractFountain } from "./fountain.js";
import { extractPdf } from "./pdf.js";
import { extractPlaintext } from "./plaintext.js";
import type { EventStream } from "./types.js";

export interface ParsedContent {
  scenes: Scene[];
  characters: Character[];
  /** Canonical plaintext reconstruction — used as Script.rawText for pdf/fdx sources. */
  rawText: string;
}

/**
 * Dispatches to the right format-specific extractor, then builds the
 * scene/character index from its event stream. The size guard lives here
 * (not duplicated per-extractor) so it's enforced identically regardless of
 * source format, and — because it's checked as events stream in rather than
 * after a full parse — a script well past the limit gets rejected without
 * finishing the expensive part of the parse (all remaining pages/lines).
 */
export async function parseScript(
  input: string | Uint8Array,
  format: ScriptFormat,
): Promise<ParsedContent> {
  if (typeof input === "string" && input.length > MAX_SCRIPT_CHARS) {
    throw new ScriptTooLargeError(
      `Script text is ${input.length} chars, exceeding the ${MAX_SCRIPT_CHARS}-char limit`,
    );
  }

  const events = dispatch(input, format);
  return buildIndex(events);
}

export class ScriptTooLargeError extends Error {}

function dispatch(input: string | Uint8Array, format: ScriptFormat): EventStream {
  switch (format) {
    case "plaintext":
      return extractPlaintext(asText(input));
    case "fountain":
      return extractFountain(asText(input));
    case "fdx":
      return extractFdx(asText(input));
    case "pdf":
      return extractPdf(asBytes(input));
    default: {
      const exhaustive: never = format;
      throw new Error(`Unsupported script format: ${String(exhaustive)}`);
    }
  }
}

function asText(input: string | Uint8Array): string {
  if (typeof input === "string") return input;
  return Buffer.from(input).toString("utf-8");
}

function asBytes(input: string | Uint8Array): Uint8Array {
  if (typeof input !== "string") return input;
  return new TextEncoder().encode(input);
}

interface DraftScene {
  number: number;
  heading: string;
  location: string | null;
  timeOfDay: "INT" | "EXT" | null;
  lines: Line[];
  characterIds: string[];
}

async function buildIndex(events: EventStream): Promise<ParsedContent> {
  const scenes: DraftScene[] = [];
  const characters: Character[] = [];
  const characterIdByName = new Map<string, string>();

  let charCount = 0;
  let currentScene: DraftScene | null = null;
  let currentCharacterId: string | null = null;
  const rawTextParts: string[] = [];

  function checkSizeGuard(addedChars: number) {
    charCount += addedChars;
    if (charCount > MAX_SCRIPT_CHARS) {
      throw new ScriptTooLargeError(
        `Script exceeds the ${MAX_SCRIPT_CHARS}-char limit during parsing`,
      );
    }
  }

  function getOrCreateCharacter(name: string): string {
    const key = name.trim().toLowerCase();
    const existing = characterIdByName.get(key);
    if (existing) return existing;

    const id = randomUUID();
    characterIdByName.set(key, id);
    characters.push({ id, scriptId: "", name: name.trim(), aliases: [] });
    return id;
  }

  for await (const event of events) {
    if (event.kind === "scene") {
      if (scenes.length >= MAX_SCENES_PER_SCRIPT) {
        throw new ScriptTooLargeError(
          `Script exceeds the ${MAX_SCENES_PER_SCRIPT}-scene limit`,
        );
      }
      checkSizeGuard(event.heading.length);
      currentScene = {
        number: scenes.length + 1,
        heading: event.heading,
        location: event.location,
        timeOfDay: event.timeOfDay,
        lines: [],
        characterIds: [],
      };
      scenes.push(currentScene);
      currentCharacterId = null;
      rawTextParts.push("", event.heading);
      continue;
    }

    if (event.kind === "character") {
      checkSizeGuard(event.name.length);
      currentCharacterId = getOrCreateCharacter(event.name);
      if (currentScene && !currentScene.characterIds.includes(currentCharacterId)) {
        currentScene.characterIds.push(currentCharacterId);
      }
      rawTextParts.push(event.name);
      continue;
    }

    // event.kind === "line" — lines before any scene heading (title page,
    // preamble) are dropped rather than attached to a synthetic scene.
    if (!currentScene) continue;

    checkSizeGuard(event.text.length);
    if (currentScene.lines.length >= MAX_LINES_PER_SCENE) {
      throw new ScriptTooLargeError(
        `Scene "${currentScene.heading}" exceeds the ${MAX_LINES_PER_SCENE}-line limit`,
      );
    }

    const characterId =
      event.type === "dialogue" || event.type === "parenthetical" ? currentCharacterId : null;

    currentScene.lines.push({
      id: randomUUID(),
      sceneId: "",
      type: event.type,
      characterId,
      text: event.text,
      sceneHeading: currentScene.heading,
    });
    rawTextParts.push(event.text);
  }

  const finalScenes: Scene[] = scenes.map((s) => {
    const sceneId = randomUUID();
    return {
      id: sceneId,
      scriptId: "",
      number: s.number,
      heading: s.heading,
      location: s.location,
      timeOfDay: s.timeOfDay,
      characterIds: s.characterIds,
      lines: s.lines.map((line) => ({ ...line, sceneId })),
    };
  });

  return {
    scenes: finalScenes,
    characters,
    rawText: rawTextParts.filter(Boolean).join("\n"),
  };
}
