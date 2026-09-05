import { useCallback, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import type { Issue, IssueStatus, JobStatusResponse, Script } from "@ross/shared";
import {
  analyzeScript,
  ApiError,
  detectFormatFromFilename,
  getJobStatus,
  listIssues,
  recheckScript,
  reviseScript,
  updateIssueStatus,
  uploadScript,
} from "./api";
import { UploadPanel } from "./components/UploadPanel";
import { ScriptView } from "./components/ScriptView";
import { IssueSidebar } from "./components/IssueSidebar";
import { IssueDetail } from "./components/IssueDetail";
import { JobBanner } from "./components/JobBanner";
import { Landing } from "./components/Landing";
import { ClapperboardMark } from "./components/ClapperboardMark";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function App() {
  const [view, setView] = useState<"landing" | "workspace">("landing");

  if (view === "landing") {
    return <Landing onLaunch={() => setView("workspace")} />;
  }

  return <Workspace onBack={() => setView("landing")} />;
}

function Workspace({ onBack }: { onBack: () => void }) {
  const [script, setScript] = useState<Script | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<IssueStatus | "all">("all");
  const [job, setJob] = useState<JobStatusResponse | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const refreshIssues = useCallback(async (scriptId: string) => {
    const { issues: fresh } = await listIssues(scriptId);
    setIssues(fresh);
  }, []);

  const pollJob = useCallback(
    async (jobId: string, scriptId: string) => {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const status = await getJobStatus(jobId);
        setJob(status);
        if (status.status === "completed" || status.status === "failed") {
          if (status.status === "completed") await refreshIssues(scriptId);
          return;
        }
        await sleep(1500);
      }
    },
    [refreshIssues],
  );

  async function handleUpload(file: File, title?: string) {
    setUploadBusy(true);
    setUploadError(null);
    try {
      const { script: uploaded } = await uploadScript(file, title);
      setScript(uploaded);
      setIssues([]);
      setSelectedIssueId(null);
      const { jobId } = await analyzeScript(uploaded.id);
      void pollJob(jobId, uploaded.id);
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }

  async function handleRevise(file: File, title?: string) {
    if (!script) return;
    setUploadBusy(true);
    setUploadError(null);
    try {
      const { script: revised, affectedSceneIds } = await reviseScript(script.id, file, title);
      setScript(revised);
      await refreshIssues(revised.id);
      if (affectedSceneIds.length > 0) {
        const { jobId } = await recheckScript(revised.id, affectedSceneIds);
        void pollJob(jobId, revised.id);
      }
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Revision failed");
    } finally {
      setUploadBusy(false);
    }
  }

  async function handleRecheck(sceneIds: string[]) {
    if (!script) return;
    setActionBusy(true);
    try {
      const { jobId } = await recheckScript(script.id, sceneIds);
      await pollJob(jobId, script.id);
    } finally {
      setActionBusy(false);
    }
  }

  async function handleTransition(issueId: string, status: IssueStatus, dismissedReason?: string) {
    setActionBusy(true);
    try {
      const { issue } = await updateIssueStatus(issueId, status, dismissedReason);
      setIssues((prev) => prev.map((i) => (i.id === issue.id ? issue : i)));
    } finally {
      setActionBusy(false);
    }
  }

  const filteredIssues = useMemo(() => {
    const sorted = [...issues].sort((a, b) => {
      const severityRank = { critical: 0, high: 1, medium: 2, low: 3 };
      if (severityRank[a.severity] !== severityRank[b.severity]) {
        return severityRank[a.severity] - severityRank[b.severity];
      }
      return b.confidence - a.confidence;
    });
    return statusFilter === "all" ? sorted : sorted.filter((i) => i.status === statusFilter);
  }, [issues, statusFilter]);

  const selectedIssue = issues.find((i) => i.id === selectedIssueId) ?? null;
  const highlightedSceneIds = new Set(selectedIssue?.sceneIds ?? []);

  return (
    <main className="shell shell-wide">
      <button className="app-header-back" onClick={onBack}>
        <Icon icon="solar:arrow-left-linear" className="icon" width={16} />
        Back
      </button>
      <header className="app-header">
        <div>
          <p className="eyebrow">Agentic script supervisor</p>
          <h1>
            <ClapperboardMark size={34} className="app-title-mark" />
            Ross
          </h1>
          <p className="tagline">
            Script continuity + real-world fact checks for the writers&apos; room.
          </p>
        </div>
        {script && (
          <span className="status-pill">
            <Icon icon="solar:document-text-bold" className="icon" width={16} />
            {script.title}
          </span>
        )}
      </header>

      {job && <JobBanner job={job} />}

      {!script && (
        <UploadPanel onUpload={handleUpload} busy={uploadBusy} error={uploadError} />
      )}

      {script && (
        <>
          <section className="card revise-card">
            <span className="muted">
              {script.scenes.length} scenes · uploaded {new Date(script.uploadedAt).toLocaleString()}
            </span>
            <label className="revise-upload">
              Upload a revision
              <input
                type="file"
                accept=".txt,.fountain,.fdx,.pdf"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && detectFormatFromFilename(file.name)) void handleRevise(file);
                }}
              />
            </label>
          </section>

          <div className="workspace">
            <ScriptView script={script} highlightedSceneIds={highlightedSceneIds} />
            <div className="issue-column">
              <IssueSidebar
                issues={filteredIssues}
                selectedId={selectedIssueId}
                onSelect={setSelectedIssueId}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
              />
              {selectedIssue && (
                <IssueDetail
                  issue={selectedIssue}
                  script={script}
                  busy={actionBusy}
                  onTransition={(status, dismissedReason) =>
                    handleTransition(selectedIssue.id, status, dismissedReason)
                  }
                  onRecheck={handleRecheck}
                />
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
