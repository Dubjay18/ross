import { useState } from "react";
import { Icon } from "@iconify/react";
import { isValidTransition, type Issue, type IssueStatus, type Script } from "@ross/shared";

interface IssueDetailProps {
  issue: Issue;
  script: Script;
  onTransition: (status: IssueStatus) => Promise<void>;
  onRecheck: (sceneIds: string[]) => Promise<void>;
  busy: boolean;
}

const TRANSITIONS: { to: IssueStatus; label: string }[] = [
  { to: "investigating", label: "Investigate" },
  { to: "confirmed", label: "Confirm" },
  { to: "dismissed", label: "Dismiss" },
  { to: "resolved", label: "Resolve" },
  { to: "open", label: "Reopen" },
];

export function IssueDetail({ issue, script, onTransition, onRecheck, busy }: IssueDetailProps) {
  const [actionError, setActionError] = useState<string | null>(null);

  const scenes = script.scenes.filter((s) => issue.sceneIds.includes(s.id));
  const available = TRANSITIONS.filter((t) => isValidTransition(issue.status, t.to));

  async function handleTransition(to: IssueStatus) {
    setActionError(null);
    try {
      await onTransition(to);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Transition failed");
    }
  }

  return (
    <section className="card issue-detail">
      <h2>{issue.title}</h2>
      <p className="muted">
        {issue.type} · {issue.severity} · confidence {(issue.confidence * 100).toFixed(0)}%
      </p>
      {issue.sourceConflict && (
        <p className="badge badge-disputed">
          <Icon icon="solar:danger-circle-bold" className="icon" width={14} />
          Disputed — {issue.sourceConflict.supportingCount} confirm ·{" "}
          {issue.sourceConflict.disputingCount} dispute
        </p>
      )}

      <h3>Description</h3>
      <p>{issue.description}</p>

      <h3>Evidence</h3>
      <p className="mono">{issue.evidence}</p>

      <h3>Scenes</h3>
      <ul>
        {scenes.map((s) => (
          <li key={s.id}>
            <a href={`#scene-${s.id}`}>
              {s.number}. {s.heading}
            </a>
          </li>
        ))}
      </ul>

      {issue.sources.length > 0 && (
        <>
          <h3>Sources</h3>
          <ul>
            {issue.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>{" "}
                <span className={source.supportsVerdict ? "ok" : "bad"}>
                  <Icon
                    icon={source.supportsVerdict ? "solar:check-circle-bold" : "solar:close-circle-bold"}
                    className="icon"
                    width={14}
                  />{" "}
                  {source.supportsVerdict ? "supports" : "disputes"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>Actions</h3>
      <div className="action-row">
        {available.map((t) => (
          <button key={t.to} className="btn" disabled={busy} onClick={() => handleTransition(t.to)}>
            {t.label}
          </button>
        ))}
        <button
          className="btn"
          disabled={busy || issue.sceneIds.length === 0}
          onClick={() => onRecheck(issue.sceneIds)}
        >
          <Icon icon="solar:refresh-bold" className="icon" width={14} />
          Re-check scenes
        </button>
      </div>
      {actionError && (
        <p className="bad">
          <Icon icon="solar:danger-circle-bold" className="icon" width={14} /> {actionError}
        </p>
      )}
    </section>
  );
}
