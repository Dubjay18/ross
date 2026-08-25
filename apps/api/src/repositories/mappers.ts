import type {
  Character as PrismaCharacter,
  Line as PrismaLine,
  Scene as PrismaScene,
  Script as PrismaScript,
  Issue as PrismaIssue,
  IssueSource as PrismaIssueSource,
  AnalysisJob as PrismaAnalysisJob,
} from "@prisma/client";
import type {
  Character,
  Line,
  Scene,
  Script,
  Issue,
  Source,
  SourceConflict,
  AnalysisJob,
} from "@ross/shared";

export function toCharacter(row: PrismaCharacter): Character {
  return {
    id: row.id,
    scriptId: row.scriptId,
    name: row.name,
    aliases: row.aliases,
  };
}

export function toLine(row: PrismaLine): Line {
  return {
    id: row.id,
    sceneId: row.sceneId,
    type: row.type,
    characterId: row.characterId,
    text: row.text,
    sceneHeading: row.sceneHeading,
  };
}

export function toScene(row: PrismaScene & { lines?: PrismaLine[] }): Scene {
  return {
    id: row.id,
    scriptId: row.scriptId,
    number: row.number,
    heading: row.heading,
    location: row.location,
    timeOfDay: row.timeOfDay,
    lines: (row.lines ?? []).map(toLine),
    characterIds: row.characterIds,
  };
}

export function toScript(
  row: PrismaScript & {
    scenes?: (PrismaScene & { lines?: PrismaLine[] })[];
    characters?: PrismaCharacter[];
  },
): Script {
  return {
    id: row.id,
    title: row.title,
    rawText: row.rawText,
    format: row.format,
    scenes: (row.scenes ?? []).map(toScene),
    characters: (row.characters ?? []).map(toCharacter),
    uploadedAt: row.uploadedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSource(row: PrismaIssueSource): Source {
  return {
    url: row.url,
    title: row.title,
    snippet: row.snippet,
    supportsVerdict: row.supportsVerdict,
    retrievedAt: row.retrievedAt.toISOString(),
  };
}

export function toIssue(
  row: PrismaIssue & { sources?: PrismaIssueSource[] },
): Issue {
  return {
    id: row.id,
    scriptId: row.scriptId,
    type: row.type,
    severity: row.severity,
    confidence: row.confidence,
    status: row.status,
    title: row.title,
    description: row.description,
    evidence: row.evidence,
    sceneIds: row.sceneIds,
    characterIds: row.characterIds,
    entityName: row.entityName,
    sources: (row.sources ?? []).map(toSource),
    sourceConflict: row.sourceConflict as SourceConflict | null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    dismissedReason: row.dismissedReason,
    recheckCount: row.recheckCount,
    lastRecheckAt: row.lastRecheckAt?.toISOString() ?? null,
  };
}

export function toAnalysisJob(row: PrismaAnalysisJob): AnalysisJob {
  return {
    id: row.id,
    scriptId: row.scriptId,
    status: row.status,
    mode: row.mode,
    sceneIds: row.sceneIds,
    progress: row.progress,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}
