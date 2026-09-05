import { prisma } from "../db.js";
import type { Issue, IssueDraft, IssueStatus, IssueType, Severity } from "@ross/shared";
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

export async function createIssuesFromDrafts(
  scriptId: string,
  drafts: IssueDraft[],
): Promise<Issue[]> {
  if (drafts.length === 0) return [];

  const rows = await prisma.$transaction(
    drafts.map((draft) =>
      prisma.issue.create({
        data: {
          scriptId,
          type: draft.type,
          severity: draft.severity,
          confidence: draft.confidence,
          title: draft.title,
          description: draft.description,
          evidence: draft.evidence,
          sceneIds: draft.sceneIds,
          characterIds: draft.characterIds,
          entityName: draft.entityName,
          sourceConflict: draft.sourceConflict ?? undefined,
          sources: {
            create: draft.sources.map((s) => ({
              url: s.url,
              title: s.title,
              snippet: s.snippet,
              supportsVerdict: s.supportsVerdict,
              retrievedAt: new Date(s.retrievedAt),
            })),
          },
        },
        include: { sources: true },
      }),
    ),
  );

  return rows.map(toIssue);
}

/**
 * Auto-resolves issues whose scene references no longer exist after a script
 * revision — an issue only tied to scenes that vanished can't be re-verified,
 * so it's closed rather than left open forever. Issues that also touch a
 * scene that still exists are left alone.
 */
export async function resolveIssuesForRemovedScenes(
  scriptId: string,
  removedSceneIds: string[],
): Promise<number> {
  if (removedSceneIds.length === 0) return 0;

  const candidates = await prisma.issue.findMany({
    where: {
      scriptId,
      status: { notIn: ["resolved", "dismissed"] },
      sceneIds: { hasSome: removedSceneIds },
    },
    select: { id: true, sceneIds: true },
  });

  const toResolve = candidates
    .filter((issue) => issue.sceneIds.every((id) => removedSceneIds.includes(id)))
    .map((issue) => issue.id);

  if (toResolve.length === 0) return 0;

  await prisma.issue.updateMany({
    where: { id: { in: toResolve } },
    data: { status: "resolved", resolvedAt: new Date(), dismissedReason: "scene_removed" },
  });

  return toResolve.length;
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
