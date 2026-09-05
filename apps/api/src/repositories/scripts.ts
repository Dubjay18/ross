import { randomUUID, createHash } from "node:crypto";
import { prisma } from "../db.js";
import type { Line, Scene, Script, ScriptFormat } from "@ross/shared";
import { parseScript, type ParsedContent } from "../parser/index.js";
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

function sceneContentHash(heading: string, lines: Pick<Line, "text">[]): string {
  return createHash("sha256")
    .update(heading + "\n" + lines.map((l) => l.text).join("\n"))
    .digest("hex");
}

export interface ScriptRevisionResult {
  script: Script;
  affectedSceneIds: string[];
  removedSceneIds: string[];
}

/**
 * Applies a new version of a script's content, matching scenes to their
 * previous row by position (scene numbers are assigned sequentially with no
 * gaps, so position === number - 1 on both sides). Unchanged scenes keep
 * their id — and therefore stay valid on any Issue.sceneIds pointing at them
 * — changed scenes are updated in place (new id would orphan existing
 * issues), and only trailing additions/removals get new/deleted rows.
 * Characters are matched by name so their ids stay stable across a revision.
 */
export async function updateScriptContent(
  scriptId: string,
  input: { title?: string; format: ScriptFormat; content: string | Uint8Array },
): Promise<ScriptRevisionResult> {
  const existing = await prisma.script.findUniqueOrThrow({
    where: { id: scriptId },
    include: scriptInclude,
  });

  const parsed: ParsedContent = await parseScript(input.content, input.format);
  const rawText =
    typeof input.content === "string" && input.format !== "fdx" ? input.content : parsed.rawText;

  const existingCharByName = new Map(
    existing.characters.map((c) => [c.name.trim().toLowerCase(), c]),
  );
  const charIdRemap = new Map<string, string>();
  for (const c of parsed.characters) {
    const match = existingCharByName.get(c.name.trim().toLowerCase());
    charIdRemap.set(c.id, match ? match.id : c.id);
  }
  const remapId = (id: string) => charIdRemap.get(id) ?? id;

  const newScenes: Scene[] = parsed.scenes.map((s) => ({
    ...s,
    characterIds: s.characterIds.map(remapId),
    lines: s.lines.map((l) => ({ ...l, characterId: l.characterId ? remapId(l.characterId) : null })),
  }));

  const oldScenes = existing.scenes;
  const maxLen = Math.max(oldScenes.length, newScenes.length);
  const affectedSceneIds: string[] = [];
  const removedSceneIds: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < maxLen; i++) {
      const oldScene = oldScenes[i];
      const newScene = newScenes[i];

      if (oldScene && newScene) {
        const oldHash = sceneContentHash(oldScene.heading, oldScene.lines);
        const newHash = sceneContentHash(newScene.heading, newScene.lines);
        if (oldHash === newHash) continue;

        await tx.line.deleteMany({ where: { sceneId: oldScene.id } });
        await tx.scene.update({
          where: { id: oldScene.id },
          data: {
            heading: newScene.heading,
            location: newScene.location,
            timeOfDay: newScene.timeOfDay,
            characterIds: newScene.characterIds,
          },
        });
        if (newScene.lines.length > 0) {
          await tx.line.createMany({
            data: newScene.lines.map((l) => ({ ...l, sceneId: oldScene.id })),
          });
        }
        affectedSceneIds.push(oldScene.id);
      } else if (oldScene && !newScene) {
        removedSceneIds.push(oldScene.id);
        await tx.scene.delete({ where: { id: oldScene.id } });
      } else if (!oldScene && newScene) {
        const sceneId = randomUUID();
        await tx.scene.create({
          data: {
            id: sceneId,
            scriptId,
            number: newScene.number,
            heading: newScene.heading,
            location: newScene.location,
            timeOfDay: newScene.timeOfDay,
            characterIds: newScene.characterIds,
          },
        });
        if (newScene.lines.length > 0) {
          await tx.line.createMany({
            data: newScene.lines.map((l) => ({ ...l, sceneId })),
          });
        }
        affectedSceneIds.push(sceneId);
      }
    }

    const newNames = new Set(parsed.characters.map((c) => c.name.trim().toLowerCase()));
    const toDelete = existing.characters.filter((c) => !newNames.has(c.name.trim().toLowerCase()));
    if (toDelete.length > 0) {
      await tx.character.deleteMany({ where: { id: { in: toDelete.map((c) => c.id) } } });
    }

    const toCreate = parsed.characters.filter(
      (c) => !existingCharByName.has(c.name.trim().toLowerCase()),
    );
    if (toCreate.length > 0) {
      await tx.character.createMany({
        data: toCreate.map((c) => ({ id: c.id, scriptId, name: c.name, aliases: c.aliases })),
      });
    }

    await tx.script.update({
      where: { id: scriptId },
      data: {
        title: input.title ?? existing.title,
        format: input.format,
        rawText,
      },
    });
  });

  const row = await prisma.script.findUniqueOrThrow({
    where: { id: scriptId },
    include: scriptInclude,
  });
  return { script: toScript(row), affectedSceneIds, removedSceneIds };
}
