import type {
  AnalyzeResponse,
  GetScriptResponse,
  IssueStatus,
  JobStatusResponse,
  ListIssuesResponse,
  RecheckResponse,
  Script,
  ScriptFormat,
  UpdateIssueResponse,
  UpdateScriptResponse,
  UploadScriptResponse,
} from "@ross/shared";

const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? `Request to ${path} failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export function uploadScript(file: File, title?: string): Promise<UploadScriptResponse> {
  const form = new FormData();
  form.append("file", file);
  if (title) form.append("title", title);
  return request("/scripts", { method: "POST", body: form });
}

export function getScript(id: string): Promise<GetScriptResponse> {
  return request(`/scripts/${id}`);
}

export function reviseScript(
  id: string,
  file: File,
  title?: string,
): Promise<UpdateScriptResponse> {
  const form = new FormData();
  form.append("file", file);
  if (title) form.append("title", title);
  return request(`/scripts/${id}`, { method: "PATCH", body: form });
}

export function listIssues(
  scriptId: string,
  filters?: { status?: IssueStatus },
): Promise<ListIssuesResponse> {
  const qs = filters?.status ? `?status=${filters.status}` : "";
  return request(`/scripts/${scriptId}/issues${qs}`);
}

export function analyzeScript(scriptId: string): Promise<AnalyzeResponse> {
  return request(`/scripts/${scriptId}/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "full" }),
  });
}

export function recheckScript(scriptId: string, sceneIds: string[]): Promise<RecheckResponse> {
  return request(`/scripts/${scriptId}/recheck`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sceneIds }),
  });
}

export function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  return request(`/jobs/${jobId}`);
}

export function updateIssueStatus(
  issueId: string,
  status: IssueStatus,
  dismissedReason?: string,
): Promise<UpdateIssueResponse> {
  return request(`/issues/${issueId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status, dismissedReason }),
  });
}

export function detectFormatFromFilename(filename: string): ScriptFormat | null {
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
      return null;
  }
}

export type { Script };
