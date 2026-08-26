export type ParsedLineType = "action" | "dialogue" | "parenthetical" | "transition";

export type ParsedEvent =
  | {
      kind: "scene";
      heading: string;
      location: string | null;
      timeOfDay: "INT" | "EXT" | null;
    }
  | { kind: "character"; name: string }
  | { kind: "line"; type: ParsedLineType; text: string };

/**
 * Every format-specific extractor implements this. Yielding one event (or a
 * small batch) at a time — rather than returning a pre-built array — is what
 * lets buildIndex() abort early on an oversized document and lets long
 * documents be processed without blocking the event loop for their whole
 * duration (see chunking notes in fountain.ts/pdf.ts).
 */
export type EventStream = AsyncGenerator<ParsedEvent, void, void>;

/** Cooperative yield — hands control back to the event loop between chunks. */
export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
