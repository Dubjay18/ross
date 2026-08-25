import { z } from "zod";
import { JobStatusSchema } from "./api.js";

export type JobStatus = z.infer<typeof JobStatusSchema>;

export const AnalysisJobSchema = z.object({
  id: z.string().uuid(),
  scriptId: z.string().uuid(),
  status: JobStatusSchema,
  mode: z.enum(["full", "partial"]),
  sceneIds: z.array(z.string().uuid()),
  progress: z.number().min(0).max(100).nullable(),
  error: z.string().nullable(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
});

export type AnalysisJob = z.infer<typeof AnalysisJobSchema>;
