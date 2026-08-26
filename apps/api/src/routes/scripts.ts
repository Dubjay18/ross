import { Hono } from "hono";
import {
  UploadScriptRequestSchema,
  ScriptFormatSchema,
  type ScriptFormat,
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
import { HttpError, NotFoundError } from "../errors.js";
import { parseScript } from "../parser/index.js";

export const scriptsRouter = new Hono();

scriptsRouter.post("/", async (c) => {
  const contentType = c.req.header("content-type") ?? "";
  const isMultipart = contentType.includes("multipart/form-data");

  let title: string | undefined;
  let format: ScriptFormat;
  let input: string | Uint8Array;

  if (isMultipart) {
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new HttpError(400, "multipart upload requires a 'file' field");
    }

    const titleField = form.get("title");
    title = typeof titleField === "string" && titleField.length > 0 ? titleField : undefined;

    const formatField = form.get("format");
    format =
      typeof formatField === "string" && formatField.length > 0
        ? ScriptFormatSchema.parse(formatField)
        : detectFormatFromFilename(file.name);

    input = format === "pdf" ? new Uint8Array(await file.arrayBuffer()) : await file.text();
  } else {
    const body = UploadScriptRequestSchema.parse(await c.req.json());
    title = body.title;
    format = body.format;
    input = body.content;
  }

  const parsed = await parseScript(input, format);
  // Plaintext/Fountain input is already canonical text — preserve it as-is.
  // PDF/FDX rawText is the reconstructed plaintext (see ParsedContent docs).
  const rawText = typeof input === "string" && format !== "fdx" ? input : parsed.rawText;

  const script = await createScript({
    title: title ?? "Untitled",
    format,
    rawText,
    parsed,
  });
  const response: UploadScriptResponse = { script };
  return c.json(response, 201);
});

function detectFormatFromFilename(filename: string): ScriptFormat {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "pdf";
    case "fdx":
      return "fdx";
    case "fountain":
      return "fountain";
    case "txt":
      return "plaintext";
    default:
      throw new HttpError(
        400,
        `Cannot infer script format from filename "${filename}" — pass an explicit "format" field`,
      );
  }
}

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
