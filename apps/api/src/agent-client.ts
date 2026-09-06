import type { AnalyzeAgentRequest, AnalyzeAgentResponse, Script } from "@ross/shared";
import { GoogleAuth } from "google-auth-library";

const AGENT_URL = process.env.AGENT_URL ?? "http://localhost:8000";

export class AgentError extends Error {}

function isLocalhost(url: string): boolean {
  return url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1");
}

async function getAgentAuthHeaders(): Promise<Record<string, string>> {
  if (isLocalhost(AGENT_URL)) {
    return {};
  }

  const audience = AGENT_URL.replace(/\/$/, "");
  const client = await new GoogleAuth().getIdTokenClient(audience);
  const headers = await client.getRequestHeaders();
  const auth = headers.authorization ?? headers.Authorization;
  return auth ? { authorization: auth } : {};
}

async function callAgent(path: "/analyze" | "/recheck", body: AnalyzeAgentRequest): Promise<AnalyzeAgentResponse> {
  let res: Response;
  try {
    const authHeaders = await getAgentAuthHeaders();
    res = await fetch(`${AGENT_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new AgentError(`Agent unreachable at ${AGENT_URL}${path}: ${(err as Error).message}`);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new AgentError(`Agent ${path} responded ${res.status}: ${detail.slice(0, 500)}`);
  }

  return (await res.json()) as AnalyzeAgentResponse;
}

export function analyzeScript(
  script: Script,
  mode: "full" | "partial",
  sceneIds: string[],
): Promise<AnalyzeAgentResponse> {
  return callAgent("/analyze", { script, mode, sceneIds });
}

export function recheckScript(script: Script, sceneIds: string[]): Promise<AnalyzeAgentResponse> {
  return callAgent("/recheck", { script, mode: "partial", sceneIds });
}
