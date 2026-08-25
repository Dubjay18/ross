/** Placeholder — full Script/Issue contracts land in Module 1. */
export const ROSS_VERSION = "0.0.0" as const;

export type HealthStatus = {
  ok: true;
  service: "api" | "agent" | "web";
  version?: string;
};
