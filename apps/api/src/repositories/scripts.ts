import { randomUUID } from "node:crypto";
import { prisma } from "../db.js";
import type { Script, ScriptFormat } from "@ross/shared";
import type { ParsedContent } from "../parser/index.js";
import { toScript } from "./mappers.js";

const scriptInclude = {
  characters: true,
  scenes: { include: { lines: true }, orderBy: { number: "asc" as const } },
};

export async function createScript(input: {
  title: string;
  format: ScriptFormat;
  rawText: string;
  parsed: ParsedContent;
}): Promise<Script> {
  const scriptId = randomUUID();
  const { scenes, characters } = input.parsed;

  await prisma.$transaction(async (tx) => {
    await tx.script.create({
      data: {
        id: scriptId,
        title: input.title,
        format: input.format,
        rawText: input.rawText,
      },
    });

    if (characters.length > 0) {
      await tx.character.createMany({
        data: characters.map((c) => ({ ...c, scriptId })),
      });
    }

    if (scenes.length > 0) {
      await tx.scene.createMany({
        data: scenes.map(({ lines: _lines, ...scene }) => ({ ...scene, scriptId })),
      });

      const allLines = scenes.flatMap((s) => s.lines);
      if (allLines.length > 0) {
        await tx.line.createMany({ data: allLines });
      }
    }
  });

  const row = await prisma.script.findUniqueOrThrow({
    where: { id: scriptId },
    include: scriptInclude,
  });
  return toScript(row);
}

export async function getScriptById(id: string): Promise<Script | null> {
  const row = await prisma.script.findUnique({
    where: { id },
    include: scriptInclude,
  });
  return row ? toScript(row) : null;
}

export async function scriptExists(id: string): Promise<boolean> {
  const row = await prisma.script.findUnique({
    where: { id },
    select: { id: true },
  });
  return row !== null;
}
