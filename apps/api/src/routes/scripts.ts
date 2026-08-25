import { Hono } from "hono";
import {
  UploadScriptRequestSchema,
  type UploadScriptResponse,
  type GetScriptResponse,
  ListIssuesQuerySchema,
  type ListIssuesResponse,
  AnalyzeRequestSchema,
  type AnalyzeResponse,
  RecheckRequestSchema,
  type RecheckResponse,
} from "@ross/shared";
import { createScript, getScriptById } from "../repositories/scripts.js";
import { listIssuesForScript } from "../repositories/issues.js";
import { createAnalysisJob } from "../repositories/jobs.js";
import { NotFoundError } from "../errors.js";

export const scriptsRouter = new Hono();

scriptsRouter.post("/", async (c) => {
  const body = UploadScriptRequestSchema.parse(await c.req.json());
  const script = await createScript({
    title: body.title ?? "Untitled",
    format: body.format,
    rawText: body.content,
  });
  const response: UploadScriptResponse = { script };
  return c.json(response, 201);
});

scriptsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const script = await getScriptById(id);
  if (!script) throw new NotFoundError("Script", id);
  const response: GetScriptResponse = { script };
  return c.json(response);
});

scriptsRouter.get("/:id/issues", async (c) => {
  const id = c.req.param("id");
  if (!(await getScriptById(id))) throw new NotFoundError("Script", id);

  const query = ListIssuesQuerySchema.parse({
    status: c.req.query("status"),
    severity: c.req.query("severity"),
    type: c.req.query("type"),
  });
  const { issues, total } = await listIssuesForScript(id, query);
  const response: ListIssuesResponse = { issues, total };
  return c.json(response);
});

scriptsRouter.post("/:id/analyze", async (c) => {
  const id = c.req.param("id");
  if (!(await getScriptById(id))) throw new NotFoundError("Script", id);

  const body = AnalyzeRequestSchema.parse(
    await c.req.json().catch(() => ({})),
  );
  const job = await createAnalysisJob({
    scriptId: id,
    mode: body.mode,
    sceneIds: body.sceneIds ?? [],
  });
  const response: AnalyzeResponse = { jobId: job.id, status: job.status };
  return c.json(response, 202);
});

scriptsRouter.post("/:id/recheck", async (c) => {
  const id = c.req.param("id");
  if (!(await getScriptById(id))) throw new NotFoundError("Script", id);

  const body = RecheckRequestSchema.parse(await c.req.json());
  const job = await createAnalysisJob({
    scriptId: id,
    mode: "partial",
    sceneIds: body.sceneIds,
  });
  const response: RecheckResponse = { jobId: job.id, status: job.status };
  return c.json(response, 202);
});
