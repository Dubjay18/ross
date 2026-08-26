import { z } from "zod";
import { ScriptSchema } from "./script.js";
import { IssueSchema, IssueStatusSchema } from "./issue.js";

// ── Upload Script ──

// JSON body path — text-based formats only. Binary formats (pdf) must use
// the multipart/form-data path on the same endpoint (see apps/api routes).
export const UploadScriptRequestSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1),
  format: z.enum(["plaintext", "fountain", "fdx"]).default("plaintext"),
});

export type UploadScriptRequest = z.infer<typeof UploadScriptRequestSchema>;

export const UploadScriptResponseSchema = z.object({
  script: ScriptSchema,
});

export type UploadScriptResponse = z.infer<typeof UploadScriptResponseSchema>;

// ── Get Script ──

export const GetScriptResponseSchema = z.object({
  script: ScriptSchema,
});

export type GetScriptResponse = z.infer<typeof GetScriptResponseSchema>;

// ── List Issues ──

export const ListIssuesQuerySchema = z.object({
  status: IssueStatusSchema.optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  type: z
    .enum([
      "continuity_prop",
      "continuity_wardrobe",
      "continuity_injury",
      "timeline",
      "geography",
      "character_knowledge",
      "external_fact",
      "ambiguous",
      "unverifiable",
    ])
    .optional(),
});

export type ListIssuesQuery = z.infer<typeof ListIssuesQuerySchema>;

export const ListIssuesResponseSchema = z.object({
  issues: z.array(IssueSchema),
  total: z.number().int().nonnegative(),
});

export type ListIssuesResponse = z.infer<typeof ListIssuesResponseSchema>;

// ── Update Issue ──

export const UpdateIssueRequestSchema = z.object({
  status: IssueStatusSchema.optional(),
  dismissedReason: z.string().nullable().optional(),
});

export type UpdateIssueRequest = z.infer<typeof UpdateIssueRequestSchema>;

export const UpdateIssueResponseSchema = z.object({
  issue: IssueSchema,
});

export type UpdateIssueResponse = z.infer<typeof UpdateIssueResponseSchema>;

// ── Analyze Script ──

export const AnalyzeRequestSchema = z.object({
  mode: z.enum(["full", "partial"]).default("full"),
  sceneIds: z.array(z.string().uuid()).optional(),
});

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

export const JobStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
]);

export type JobStatus = z.infer<typeof JobStatusSchema>;

export const AnalyzeResponseSchema = z.object({
  jobId: z.string().uuid(),
  status: JobStatusSchema,
});

export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;

// ── Job Status ──

export const JobStatusResponseSchema = z.object({
  jobId: z.string().uuid(),
  status: JobStatusSchema,
  progress: z.number().min(0).max(100).nullable(),
  error: z.string().nullable(),
});

export type JobStatusResponse = z.infer<typeof JobStatusResponseSchema>;

// ── Recheck ──

export const RecheckRequestSchema = z.object({
  sceneIds: z.array(z.string().uuid()).min(1),
});

export type RecheckRequest = z.infer<typeof RecheckRequestSchema>;

export const RecheckResponseSchema = z.object({
  jobId: z.string().uuid(),
  status: JobStatusSchema,
});

export type RecheckResponse = z.infer<typeof RecheckResponseSchema>;
