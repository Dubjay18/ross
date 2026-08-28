"""Module 7: conflict resolution, severity ranking, and deduplication.

The agent returns a single, clean list of IssueDrafts to the API. This module:

1. Deduplicates issues that share the same scene(s) + entity/claim.
2. Merges sources[] across duplicates.
3. Rebuilds SourceConflict when merged sources disagree.
4. Sorts by severity, confidence, and earliest scene number so presentation
   order is stable even when the LLM's wording varies run-to-run.
"""

from __future__ import annotations

import logging
from typing import Optional

from app.models import IssueDraft, Script, Source, SourceConflict, SEVERITY_ORDER

logger = logging.getLogger(__name__)


def _normalize(text: Optional[str]) -> str:
    """Lower-case, strip, and collapse whitespace for dedup comparison."""
    if not text:
        return ""
    return " ".join(text.lower().split())


def _dedup_key(issue: IssueDraft) -> tuple:
    """Key used to group duplicate issues.

    Uses the entity name when available; falls back to the title so unrelated
    issues in the same scene are not accidentally collapsed.
    """
    entity = _normalize(issue.entity_name) or _normalize(issue.title)
    return (entity, frozenset(issue.scene_ids))


def _earliest_scene_number(issue: IssueDraft, script: Script) -> int:
    """Return the lowest scene number referenced by the issue, or a large sentinel."""
    scene_by_id = {scene.id: scene for scene in script.scenes}
    numbers = [
        scene_by_id[scene_id].number
        for scene_id in issue.scene_ids
        if scene_id in scene_by_id
    ]
    return min(numbers) if numbers else 999_999


def _rebuild_source_conflict(sources: list[Source]) -> Optional[SourceConflict]:
    """Return a SourceConflict if the merged sources contain both supporting and disputing entries."""
    if not sources:
        return None
    supporting = sum(1 for s in sources if s.supports_verdict)
    disputing = len(sources) - supporting
    if supporting > 0 and disputing > 0:
        return SourceConflict(
            supporting_count=supporting,
            disputing_count=disputing,
            summary=(
                f"Merged sources are split: {supporting} support the claim and "
                f"{disputing} dispute it."
            ),
        )
    return None


def _merge_source_lists(issues: list[IssueDraft]) -> list[Source]:
    """Combine sources from a group of issues, de-duplicating by URL."""
    seen: dict[str, Source] = {}
    for issue in issues:
        for src in issue.sources:
            if src.url not in seen:
                seen[src.url] = src
            # If we see the same URL again, prefer a source that supports the verdict.
            elif src.supports_verdict and not seen[src.url].supports_verdict:
                seen[src.url] = src
    return list(seen.values())


def _select_base_issue(issues: list[IssueDraft]) -> IssueDraft:
    """Pick the representative issue from a duplicate group.

    Priority:
    1. Highest severity (audience-visible continuity outranks obscure trivia)
    2. Highest confidence
    """
    return min(
        issues,
        key=lambda i: (SEVERITY_ORDER[i.severity], -i.confidence),
    )


def merge_issues(issues: list[IssueDraft], script: Script) -> list[IssueDraft]:
    """Dedupe, merge sources, and rank a combined list of IssueDrafts.

    Args:
        issues: candidate issues from Layer 1 and Layer 2.
        script: the full Script payload, used to map scene ids to scene numbers
            for stable sorting.

    Returns:
        A sorted, deduplicated list ready to return to the API.
    """
    if not issues:
        return []

    logger.info("Merge start: %d raw issues", len(issues))

    # Group potential duplicates.
    groups: dict[tuple, list[IssueDraft]] = {}
    for issue in issues:
        groups.setdefault(_dedup_key(issue), []).append(issue)

    merged: list[IssueDraft] = []
    for key, group in groups.items():
        base = _select_base_issue(group)
        merged_sources = _merge_source_lists(group)
        source_conflict = _rebuild_source_conflict(merged_sources)

        # Build a fresh IssueDraft from the base with merged sources/conflict.
        representative = base.model_copy(
            update={
                "sources": merged_sources,
                "source_conflict": source_conflict,
            },
            deep=True,
        )
        merged.append(representative)
        logger.debug(
            "Merged group entity=%r count=%d final_sources=%d",
            key[0],
            len(group),
            len(merged_sources),
        )

    # Stable ranking key: severity asc, confidence desc, earliest scene number asc.
    def sort_key(issue: IssueDraft) -> tuple:
        return (
            SEVERITY_ORDER[issue.severity],
            -issue.confidence,
            _earliest_scene_number(issue, script),
            issue.title,
        )

    result = sorted(merged, key=sort_key)
    logger.info("Merge end: %d ranked issues", len(result))
    return result
