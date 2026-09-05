import type { Script } from "@ross/shared";
import { analyzeScript, recheckScript } from "./agent-client.js";
import { createIssuesFromDrafts, resolveStaleIssuesForRecheckedScenes } from "./repositories/issues.js";
import { markJobCompleted, markJobFailed, markJobRunning } from "./repositories/jobs.js";

/**
 * Runs an analysis/recheck job against the agent and persists the resulting
 * issues, updating job status along the way. Fired without being awaited by
 * the route handler — the HTTP response returns 202 with the job id
 * immediately, and callers poll GET /jobs/:id for progress.
 */
export async function runAnalysisJob(
  jobId: string,
  script: Script,
  mode: "full" | "partial",
  sceneIds: string[],
): Promise<void> {
  try {
    await markJobRunning(jobId);
    const result =
      mode === "partial" ? await recheckScript(script, sceneIds) : await analyzeScript(script, mode, sceneIds);
    if (mode === "partial") {
      await resolveStaleIssuesForRecheckedScenes(script.id, sceneIds);
    }
    await createIssuesFromDrafts(script.id, result.issues);
    await markJobCompleted(jobId);
  } catch (err) {
    console.error(`analysis job ${jobId} failed:`, err);
    await markJobFailed(jobId, err instanceof Error ? err.message : String(err));
  }
}
