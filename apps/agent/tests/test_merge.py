"""Unit tests for Module 7 merge, dedup, and severity ranking."""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.merge import merge_issues
from app.models import IssueDraft, IssueType, Scene, Script, Severity, Source


def _make_script() -> Script:
    now = datetime.now(timezone.utc).isoformat()
    return Script(
        id="script-merge-test",
        title="Merge Test",
        raw_text="",
        format="plaintext",
        characters=[],
        scenes=[
            Scene(
                id="scene-a",
                script_id="script-merge-test",
                number=1,
                heading="INT. ROOM - DAY",
                location="ROOM",
                time_of_day="INT",
                lines=[],
                character_ids=[],
            ),
            Scene(
                id="scene-b",
                script_id="script-merge-test",
                number=2,
                heading="EXT. STREET - NIGHT",
                location="STREET",
                time_of_day="EXT",
                lines=[],
                character_ids=[],
            ),
            Scene(
                id="scene-c",
                script_id="script-merge-test",
                number=3,
                heading="INT. CAFE - DAY",
                location="CAFE",
                time_of_day="INT",
                lines=[],
                character_ids=[],
            ),
        ],
        uploaded_at=now,
        updated_at=now,
    )


def _issue(
    title: str,
    issue_type: IssueType,
    severity: Severity,
    confidence: float,
    scene_ids: list[str],
    entity_name: str | None = None,
    sources: list[Source] | None = None,
) -> IssueDraft:
    return IssueDraft(
        type=issue_type,
        severity=severity,
        confidence=confidence,
        title=title,
        description=title,
        evidence=title,
        scene_ids=scene_ids,
        entity_name=entity_name,
        sources=sources or [],
    )


def test_empty_list_returns_empty():
    script = _make_script()
    assert merge_issues([], script) == []


def test_dedupe_same_entity_and_scenes():
    script = _make_script()
    issues = [
        _issue(
            "Gun appears without introduction",
            IssueType.continuity_prop,
            Severity.high,
            0.7,
            ["scene-a", "scene-b"],
            entity_name="pistol",
            sources=[Source(url="https://a.com", title="A", snippet="x", supports_verdict=True, retrieved_at="2026-01-01T00:00:00Z")],
        ),
        _issue(
            "Pistol not established earlier",
            IssueType.continuity_prop,
            Severity.medium,
            0.9,
            ["scene-a", "scene-b"],
            entity_name="pistol",
            sources=[Source(url="https://b.com", title="B", snippet="y", supports_verdict=False, retrieved_at="2026-01-01T00:00:00Z")],
        ),
    ]

    result = merge_issues(issues, script)
    assert len(result) == 1
    merged = result[0]
    assert merged.entity_name == "pistol"
    # Should pick higher severity issue as base (high beats medium), even though confidence is lower.
    assert merged.severity == Severity.high
    # Sources from both duplicates are merged.
    assert len(merged.sources) == 2
    urls = {s.url for s in merged.sources}
    assert urls == {"https://a.com", "https://b.com"}


def test_different_entities_are_not_deduped():
    script = _make_script()
    issues = [
        _issue("Gun issue", IssueType.continuity_prop, Severity.high, 0.9, ["scene-a"], entity_name="pistol"),
        _issue("Watch issue", IssueType.continuity_prop, Severity.high, 0.9, ["scene-a"], entity_name="watch"),
    ]
    result = merge_issues(issues, script)
    assert len(result) == 2


def test_sorts_by_severity_then_confidence_then_scene_number():
    script = _make_script()
    issues = [
        _issue("Low later scene", IssueType.timeline, Severity.low, 0.9, ["scene-c"]),
        _issue("Critical early scene", IssueType.continuity_prop, Severity.critical, 0.6, ["scene-a"]),
        _issue("High mid scene", IssueType.continuity_prop, Severity.high, 0.8, ["scene-b"]),
        _issue("High early scene", IssueType.continuity_prop, Severity.high, 0.8, ["scene-a"]),
    ]

    result = merge_issues(issues, script)
    titles = [i.title for i in result]
    assert titles == [
        "Critical early scene",
        "High early scene",
        "High mid scene",
        "Low later scene",
    ]


def test_merge_source_conflict_rebuilt():
    script = _make_script()
    issues = [
        _issue(
            "Disputed fact",
            IssueType.external_fact,
            Severity.high,
            0.8,
            ["scene-a"],
            entity_name="berlin wall",
            sources=[Source(url="https://yes.com", title="Yes", snippet="yes", supports_verdict=True, retrieved_at="2026-01-01T00:00:00Z")],
        ),
        _issue(
            "Disputed fact again",
            IssueType.external_fact,
            Severity.high,
            0.85,
            ["scene-a"],
            entity_name="berlin wall",
            sources=[Source(url="https://no.com", title="No", snippet="no", supports_verdict=False, retrieved_at="2026-01-01T00:00:00Z")],
        ),
    ]

    result = merge_issues(issues, script)
    assert len(result) == 1
    conflict = result[0].source_conflict
    assert conflict is not None
    assert conflict.supporting_count == 1
    assert conflict.disputing_count == 1


def test_no_source_conflict_when_all_agree():
    script = _make_script()
    issues = [
        _issue(
            "Agreed fact",
            IssueType.external_fact,
            Severity.high,
            0.8,
            ["scene-a"],
            entity_name="moon landing",
            sources=[Source(url="https://one.com", title="One", snippet="yes", supports_verdict=True, retrieved_at="2026-01-01T00:00:00Z")],
        ),
        _issue(
            "Agreed fact again",
            IssueType.external_fact,
            Severity.high,
            0.85,
            ["scene-a"],
            entity_name="moon landing",
            sources=[Source(url="https://two.com", title="Two", snippet="yes", supports_verdict=True, retrieved_at="2026-01-01T00:00:00Z")],
        ),
    ]

    result = merge_issues(issues, script)
    assert len(result) == 1
    assert result[0].source_conflict is None
    assert len(result[0].sources) == 2
