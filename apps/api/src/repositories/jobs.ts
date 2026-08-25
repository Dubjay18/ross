import { prisma } from "../db.js";
import type { AnalysisJob } from "@ross/shared";
import { toAnalysisJob } from "./mappers.js";

export async function createAnalysisJob(input: {
  scriptId: string;
  mode: "full" | "partial";
  sceneIds: string[];
}): Promise<AnalysisJob> {
  const row = await prisma.analysisJob.create({ data: input });
  return toAnalysisJob(row);
}

export async function getJobById(id: string): Promise<AnalysisJob | null> {
  const row = await prisma.analysisJob.findUnique({ where: { id } });
  return row ? toAnalysisJob(row) : null;
}
