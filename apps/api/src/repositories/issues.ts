import { prisma } from "../db.js";
import type { Issue, IssueStatus, IssueType, Severity } from "@ross/shared";
import { toIssue } from "./mappers.js";

export async function listIssuesForScript(
  scriptId: string,
  filters: { status?: IssueStatus; severity?: Severity; type?: IssueType },
): Promise<{ issues: Issue[]; total: number }> {
  const where = {
    scriptId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.severity ? { severity: filters.severity } : {}),
    ...(filters.type ? { type: filters.type } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.issue.findMany({
      where,
      include: { sources: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.issue.count({ where }),
  ]);

  return { issues: rows.map(toIssue), total };
}

export async function getIssueById(id: string): Promise<Issue | null> {
  const row = await prisma.issue.findUnique({
    where: { id },
    include: { sources: true },
  });
  return row ? toIssue(row) : null;
}

export async function updateIssueStatus(
  id: string,
  input: { status?: IssueStatus; dismissedReason?: string | null },
): Promise<Issue> {
  const row = await prisma.issue.update({
    where: { id },
    data: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.dismissedReason !== undefined
        ? { dismissedReason: input.dismissedReason }
        : {}),
      ...(input.status === "resolved" ? { resolvedAt: new Date() } : {}),
    },
    include: { sources: true },
  });
  return toIssue(row);
}
