import { Hono } from "hono";
import type { JobStatusResponse } from "@ross/shared";
import { getJobById } from "../repositories/jobs.js";
import { NotFoundError } from "../errors.js";

export const jobsRouter = new Hono();

jobsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const job = await getJobById(id);
  if (!job) throw new NotFoundError("Job", id);

  const response: JobStatusResponse = {
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    error: job.error,
  };
  return c.json(response);
});
