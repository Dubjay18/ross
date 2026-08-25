import { z } from "zod";

// ── Enums ──

export const IssueTypeSchema = z.enum([
  "continuity_prop",
  "continuity_wardrobe",
  "continuity_injury",
  "timeline",
  "geography",
  "character_knowledge",
  "external_fact",
  "ambiguous",
  "unverifiable",
]);

export type IssueType = z.infer<typeof IssueTypeSchema>;

export const SeveritySchema = z.enum(["critical", "high", "medium", "low"]);

export type Severity = z.infer<typeof SeveritySchema>;

export const IssueStatusSchema = z.enum([
  "open",
  "investigating",
  "confirmed",
  "dismissed",
  "resolved",
]);

export type IssueStatus = z.infer<typeof IssueStatusSchema>;

// ── Source ──

export const SourceSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  snippet: z.string(),
  supportsVerdict: z.boolean(),
  retrievedAt: z.string().datetime(),
});

export type Source = z.infer<typeof SourceSchema>;

// ── Source Conflict ──

export const SourceConflictSchema = z.object({
  supportingCount: z.number().int().nonnegative(),
  disputingCount: z.number().int().nonnegative(),
  summary: z.string().min(1),
});

export type SourceConflict = z.infer<typeof SourceConflictSchema>;

// ── Issue ──

export const IssueSchema = z.object({
  id: z.string().uuid(),
  scriptId: z.string().uuid(),
  type: IssueTypeSchema,
  severity: SeveritySchema,
  confidence: z.number().min(0).max(1),
  status: IssueStatusSchema,

  title: z.string().min(1),
  description: z.string().min(1),
  evidence: z.string(),

  sceneIds: z.array(z.string().uuid()).default([]),
  characterIds: z.array(z.string().uuid()).default([]),
  entityName: z.string().nullable(),

  sources: z.array(SourceSchema).default([]),
  sourceConflict: SourceConflictSchema.nullable(),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  dismissedReason: z.string().nullable(),
  recheckCount: z.number().int().nonnegative().default(0),
  lastRecheckAt: z.string().datetime().nullable(),
});

export type Issue = z.infer<typeof IssueSchema>;

// ── Issue lifecycle helpers ──

export const VALID_STATUS_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  open: ["investigating"],
  investigating: ["confirmed", "dismissed", "open"],
  confirmed: ["resolved", "open"],
  dismissed: ["open"],
  resolved: ["open"],
};

export function isValidTransition(from: IssueStatus, to: IssueStatus): boolean {
  return VALID_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Severity ordering (highest first) ──

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITY_ORDER[a] - SEVERITY_ORDER[b];
}
