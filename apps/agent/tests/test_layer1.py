"""Integration test for Layer 1 internal continuity analysis.

This test requires GOOGLE_API_KEY to be set and google-genai installed. It runs
the real Gemini model against hand-built fixture scripts with planted errors and
asserts that the agent surfaces at least one relevant issue.

Run with pytest:
    pytest apps/agent/tests/test_layer1.py

Or as a standalone script (will print results and exit 1 on failure):
    cd apps/agent
    python tests/test_layer1.py
"""

from __future__ import annotations

import os
import sys

import pytest

# Make the app package importable when running as a standalone script.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.layer1.continuity import run_layer1
from app.models import AnalyzeAgentRequest, Script
from tests.fixtures import make_planted_injury_script, make_planted_prop_script


requires_google_key = pytest.mark.skipif(
    not os.environ.get("GOOGLE_API_KEY"),
    reason="GOOGLE_API_KEY is not set; required for live Gemini integration test",
)


def _collect_scene_ids(script: Script) -> set[str]:
    return {scene.id for scene in script.scenes}


def _has_issue_for_both_scenes(issues, expected_scene_ids: set[str]) -> bool:
    for issue in issues:
        if set(issue.scene_ids) & expected_scene_ids == expected_scene_ids:
            return True
    return False


def _issue_cites_real_scene_ids(issues, valid_scene_ids: set[str]) -> bool:
    for issue in issues:
        if not set(issue.scene_ids).issubset(valid_scene_ids):
            return False
    return True


@requires_google_key
def test_planted_injury_continuity():
    """Sarah's cast disappears between scene 1 and scene 2."""
    script = make_planted_injury_script()
    valid_scene_ids = _collect_scene_ids(script)
    request = AnalyzeAgentRequest(script=script, mode="full")

    issues = run_layer1(request)

    assert issues, "Expected at least one Layer 1 issue for the planted injury error"
    assert _issue_cites_real_scene_ids(
        issues, valid_scene_ids
    ), f"Issue cited non-existent scene ids; valid ids are {valid_scene_ids}"
    assert _has_issue_for_both_scenes(
        issues, {"scene-1", "scene-2"}
    ), "Expected an issue citing both scenes"

    injury_types = {"continuity_injury", "continuity_wardrobe", "ambiguous"}
    assert any(
        issue.type.value in injury_types for issue in issues
    ), f"Expected an injury/wardrobe/ambiguous issue, got {[i.type.value for i in issues]}"

    print("injury fixture issues:")
    for issue in issues:
        print(f"  - {issue.type.value}: {issue.title} (scenes={issue.scene_ids})")


@requires_google_key
def test_planted_prop_continuity():
    """Mike pulls a gun that was never introduced."""
    script = make_planted_prop_script()
    valid_scene_ids = _collect_scene_ids(script)
    request = AnalyzeAgentRequest(script=script, mode="full")

    issues = run_layer1(request)

    assert issues, "Expected at least one Layer 1 issue for the planted prop error"
    assert _issue_cites_real_scene_ids(
        issues, valid_scene_ids
    ), f"Issue cited non-existent scene ids; valid ids are {valid_scene_ids}"
    assert _has_issue_for_both_scenes(
        issues, {"scene-prop-1", "scene-prop-2"}
    ), "Expected an issue citing both scenes"

    print("prop fixture issues:")
    for issue in issues:
        print(f"  - {issue.type.value}: {issue.title} (scenes={issue.scene_ids})")


if __name__ == "__main__":
    if not os.environ.get("GOOGLE_API_KEY"):
        print(
            "SKIP: GOOGLE_API_KEY is not set; set it to run the integration test.",
            file=sys.stderr,
        )
        raise SystemExit(0)

    test_planted_injury_continuity()
    test_planted_prop_continuity()
    print("Layer 1 integration tests passed.")