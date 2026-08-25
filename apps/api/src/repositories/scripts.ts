import { prisma } from "../db.js";
import type { Script, ScriptFormat } from "@ross/shared";
import { toScript } from "./mappers.js";

const scriptInclude = {
  characters: true,
  scenes: { include: { lines: true }, orderBy: { number: "asc" as const } },
};

export async function createScript(input: {
  title: string;
  format: ScriptFormat;
  rawText: string;
}): Promise<Script> {
  const row = await prisma.script.create({
    data: input,
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
