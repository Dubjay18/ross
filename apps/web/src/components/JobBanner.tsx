import { Icon } from "@iconify/react";
import type { JobStatusResponse } from "@ross/shared";
import { FilmReelSpinner } from "./FilmReelSpinner";

export function JobBanner({ job }: { job: JobStatusResponse }) {
  if (job.status === "completed") return null;

  return (
    <div className={`job-banner${job.status === "failed" ? " job-banner-bad" : ""}`}>
      {job.status === "failed" ? (
        <span>
          <Icon icon="solar:danger-circle-bold" className="icon" width={16} /> Analysis failed:{" "}
          {job.error}
        </span>
      ) : (
        <span>
          <FilmReelSpinner className="job-banner-spinner" /> Analyzing script… ({job.status})
        </span>
      )}
    </div>
  );
}
