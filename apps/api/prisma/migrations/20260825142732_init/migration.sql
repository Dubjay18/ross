-- CreateEnum
CREATE TYPE "ScriptFormat" AS ENUM ('plaintext', 'fountain');

-- CreateEnum
CREATE TYPE "TimeOfDay" AS ENUM ('INT', 'EXT');

-- CreateEnum
CREATE TYPE "LineType" AS ENUM ('dialogue', 'action', 'direction', 'parenthetical', 'transition');

-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('continuity_prop', 'continuity_wardrobe', 'continuity_injury', 'timeline', 'geography', 'character_knowledge', 'external_fact', 'ambiguous', 'unverifiable');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('critical', 'high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('open', 'investigating', 'confirmed', 'dismissed', 'resolved');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "JobMode" AS ENUM ('full', 'partial');

-- CreateTable
CREATE TABLE "scripts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "format" "ScriptFormat" NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenes" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "heading" TEXT NOT NULL,
    "location" TEXT,
    "timeOfDay" "TimeOfDay",
    "characterIds" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lines" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "type" "LineType" NOT NULL,
    "characterId" TEXT,
    "text" TEXT NOT NULL,
    "sceneHeading" TEXT NOT NULL,

    CONSTRAINT "lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "type" "IssueType" NOT NULL,
    "severity" "Severity" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'open',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "sceneIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "characterIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "entityName" TEXT,
    "sourceConflict" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "dismissedReason" TEXT,
    "recheckCount" INTEGER NOT NULL DEFAULT 0,
    "lastRecheckAt" TIMESTAMP(3),

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_sources" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "supportsVerdict" BOOLEAN NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issue_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_jobs" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "mode" "JobMode" NOT NULL,
    "sceneIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "progress" DOUBLE PRECISION,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "analysis_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "characters_scriptId_idx" ON "characters"("scriptId");

-- CreateIndex
CREATE INDEX "scenes_scriptId_idx" ON "scenes"("scriptId");

-- CreateIndex
CREATE INDEX "lines_sceneId_idx" ON "lines"("sceneId");

-- CreateIndex
CREATE INDEX "issues_scriptId_idx" ON "issues"("scriptId");

-- CreateIndex
CREATE INDEX "issues_status_idx" ON "issues"("status");

-- CreateIndex
CREATE INDEX "issue_sources_issueId_idx" ON "issue_sources"("issueId");

-- CreateIndex
CREATE INDEX "analysis_jobs_scriptId_idx" ON "analysis_jobs"("scriptId");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lines" ADD CONSTRAINT "lines_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_sources" ADD CONSTRAINT "issue_sources_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
