import type { AnalyzeAgentRequest, AnalyzeAgentResponse, Script } from "@ross/shared";

const AGENT_URL = process.env.AGENT_URL ?? "http://localhost:8000";

export class AgentError extends Error {}

async function callAgent(path: "/analyze" | "/recheck", body: AnalyzeAgentRequest): Promise<AnalyzeAgentResponse> {
  let res: Response;
  try {
    res = await fetch(`${AGENT_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
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
