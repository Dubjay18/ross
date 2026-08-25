export const ROSS_VERSION = "0.0.0" as const;

export const MAX_SCRIPT_CHARS = 500_000 as const;
export const MAX_SCENES_PER_SCRIPT = 500 as const;
export const MAX_LINES_PER_SCENE = 200 as const;
export const MAX_ISSUES_PER_SCRIPT = 1_000 as const;

export const CONFIDENCE_THRESHOLD_HIGH = 0.8 as const;
export const CONFIDENCE_THRESHOLD_MEDIUM = 0.5 as const;
export const CONFIDENCE_THRESHOLD_LOW = 0.3 as const;

export type HealthStatus = {
  ok: true;
  service: "api" | "agent" | "web";
  version?: string;
};
