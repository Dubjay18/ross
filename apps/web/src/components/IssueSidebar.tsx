import { useEffect, useRef } from "react";
import { Icon } from "@iconify/react";
import { gsap } from "gsap";
import type { Issue, IssueStatus } from "@ross/shared";

const STATUS_FILTERS: (IssueStatus | "all")[] = [
  "all",
  "open",
  "investigating",
  "confirmed",
  "dismissed",
  "resolved",
];

const SEVERITY_LABEL: Record<Issue["severity"], string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

interface IssueSidebarProps {
  issues: Issue[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  statusFilter: IssueStatus | "all";
  onStatusFilterChange: (status: IssueStatus | "all") => void;
}

export function IssueSidebar({
  issues,
  selectedId,
  onSelect,
  statusFilter,
  onStatusFilterChange,
}: IssueSidebarProps) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!listRef.current) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;
    const rows = listRef.current.querySelectorAll(".issue-row");
    gsap.fromTo(
      rows,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.35, stagger: 0.03, ease: "power2.out" },
    );
  }, [issues]);

  return (
    <section className="card issue-sidebar">
      <h2>
        <Icon icon="solar:danger-triangle-bold" className="icon" width={16} />
        Issues ({issues.length})
      </h2>
      <div className="filter-row">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            className={`chip${statusFilter === status ? " chip-active" : ""}`}
            onClick={() => onStatusFilterChange(status)}
          >
            {status}
          </button>
        ))}
      </div>
      <ul className="issue-list" ref={listRef}>
        {issues.map((issue) => (
          <li key={issue.id}>
            <button
              className={`issue-row severity-${issue.severity}${issue.id === selectedId ? " issue-row-active" : ""}`}
              onClick={() => onSelect(issue.id)}
            >
              <span className={`severity-dot severity-dot-${issue.severity}`} />
              <span className="issue-row-body">
                <span className="issue-title">{issue.title}</span>
                <span className="muted issue-meta">
                  {SEVERITY_LABEL[issue.severity]} · {issue.status}
                  {issue.sourceConflict ? " · disputed" : ""}
                </span>
              </span>
            </button>
          </li>
        ))}
        {issues.length === 0 && <p className="muted">No issues match this filter.</p>}
      </ul>
    </section>
  );
}
