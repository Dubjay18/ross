import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMany = vi.fn();

vi.mock("../db.js", () => ({
  prisma: {
    issue: { updateMany },
  },
}));

const { resolveStaleIssuesForRecheckedScenes } = await import("./issues.js");

// Regression: partial recheck (e.g. "Upload a revision" or "Re-check scenes")
// never closed out issues the agent stopped reproducing — they sat open
// forever even after the underlying script text was fixed.
// Found by /qa on 2026-09-05
// Report: .gstack/qa-reports/qa-report-localhost-2026-09-05.md
describe("resolveStaleIssuesForRecheckedScenes", () => {
  beforeEach(() => {
    updateMany.mockClear();
  });

  it("resolves open/investigating/confirmed issues touching a rechecked scene, excluding resolved/dismissed", async () => {
    updateMany.mockResolvedValueOnce({ count: 2 });

    const count = await resolveStaleIssuesForRecheckedScenes("script-1", ["scene-3"]);

    expect(count).toBe(2);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        scriptId: "script-1",
        status: { notIn: ["resolved", "dismissed"] },
        sceneIds: { hasSome: ["scene-3"] },
      },
      data: {
        status: "resolved",
        resolvedAt: expect.any(Date),
        dismissedReason: "recheck_no_longer_reproduced",
      },
    });
  });

  it("does nothing when no scenes were rechecked", async () => {
    const count = await resolveStaleIssuesForRecheckedScenes("script-1", []);

    expect(count).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
