import { z } from "zod";

// ── Character ──

export const CharacterSchema = z.object({
  id: z.string().uuid(),
  scriptId: z.string().uuid(),
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
});

export type Character = z.infer<typeof CharacterSchema>;

// ── Line ──

export const LineTypeSchema = z.enum([
  "dialogue",
  "action",
  "direction",
  "parenthetical",
  "transition",
]);

export type LineType = z.infer<typeof LineTypeSchema>;

export const LineSchema = z.object({
  id: z.string().uuid(),
  sceneId: z.string().uuid(),
  type: LineTypeSchema,
  characterId: z.string().uuid().nullable(),
  text: z.string().min(1),
  sceneHeading: z.string(),
});

export type Line = z.infer<typeof LineSchema>;

// ── Scene ──

export const SceneSchema = z.object({
  id: z.string().uuid(),
  scriptId: z.string().uuid(),
  number: z.number().int().nonnegative(),
  heading: z.string().min(1),
  location: z.string().nullable(),
  timeOfDay: z.enum(["INT", "EXT"]).nullable(),
  lines: z.array(LineSchema).default([]),
  characterIds: z.array(z.string().uuid()).default([]),
});

export type Scene = z.infer<typeof SceneSchema>;

// ── Script ──

export const ScriptFormatSchema = z.enum(["plaintext", "fountain", "pdf", "fdx"]);

export type ScriptFormat = z.infer<typeof ScriptFormatSchema>;

export const ScriptSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  rawText: z.string(),
  format: ScriptFormatSchema,
  scenes: z.array(SceneSchema).default([]),
  characters: z.array(CharacterSchema).default([]),
  uploadedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Script = z.infer<typeof ScriptSchema>;
