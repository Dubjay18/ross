import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseScript, ScriptTooLargeError } from "./index.js";

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__");

function fixtureText(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), "utf-8");
}

function fixtureBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(FIXTURES_DIR, name)));
}

describe("parseScript — text-based formats (fountain, plaintext, fdx)", () => {
  const cases: { format: "fountain" | "plaintext" | "fdx"; file: string }[] = [
    { format: "fountain", file: "sample.fountain" },
    { format: "plaintext", file: "sample.txt" },
    { format: "fdx", file: "sample.fdx" },
  ];

  for (const { format, file } of cases) {
    it(`${format}: produces 2 scenes and 2 characters`, async () => {
      const result = await parseScript(fixtureText(file), format);

      expect(result.scenes).toHaveLength(2);
      expect(result.characters.map((c) => c.name).sort()).toEqual(["JANE", "JOHN"]);

      const [scene1, scene2] = result.scenes;
      expect(scene1?.heading).toBe("INT. HOUSE - DAY");
      expect(scene1?.timeOfDay).toBe("INT");
      expect(scene2?.heading).toBe("EXT. STREET - NIGHT");
      expect(scene2?.timeOfDay).toBe("EXT");

      const dialogueLines = scene1?.lines.filter((l) => l.type === "dialogue") ?? [];
      expect(dialogueLines).toHaveLength(2);
      expect(dialogueLines[0]?.text).toBe("Hello there.");
      expect(dialogueLines[1]?.text).toBe("Hi John!");

      // dialogue lines should be attributed to the right character
      const johnId = result.characters.find((c) => c.name === "JOHN")?.id;
      const janeId = result.characters.find((c) => c.name === "JANE")?.id;
      expect(dialogueLines[0]?.characterId).toBe(johnId);
      expect(dialogueLines[1]?.characterId).toBe(janeId);
    });
  }
});

describe("parseScript — pdf", () => {
  it("produces roughly the same structure (looser assertion — position-based heuristics)", async () => {
    const result = await parseScript(fixtureBytes("sample.pdf"), "pdf");

    expect(result.scenes.length).toBeGreaterThanOrEqual(2);
    const headings = result.scenes.map((s) => s.heading);
    expect(headings.some((h) => h.includes("INT. HOUSE"))).toBe(true);
    expect(headings.some((h) => h.includes("EXT. STREET"))).toBe(true);

    const names = result.characters.map((c) => c.name);
    expect(names).toContain("JOHN");
    expect(names).toContain("JANE");
  });
});

describe("parseScript — size guard", () => {
  it("rejects an oversized plaintext script before building the index", async () => {
    const oversized = "A".repeat(600_000);
    await expect(parseScript(oversized, "plaintext")).rejects.toBeInstanceOf(ScriptTooLargeError);
  });
});
