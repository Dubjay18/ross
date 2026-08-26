"""Agent tools.

This module defines the functions the Gemini model can call during analysis,
plus helper utilities for looking up scenes and tracking emitted issues.

For Module 4 the tools are stubs:
- `flag_issue` appends to an in-memory list.
- `search_parallel` returns a canned empty/mock result.
- `get_scene` reads from the request's `Script` payload.

Module 5 fills in `flag_issue` reasoning; Module 6 replaces
`search_parallel` with a real Parallel Search API call.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from app.models import IssueDraft, IssueType, Scene, Script, Severity, Source, SourceConflict

logger = logging.getLogger(__name__)


# ── Issue registry ──


class IssueRegistry:
    """Simple in-memory collector for candidate issues during one analysis pass."""

    def __init__(self) -> None:
        self.issues: list[IssueDraft] = []

    def reset(self) -> None:
        self.issues = []


def flag_issue(
    registry: IssueRegistry,
    issue_type: str,
    severity: str,
    confidence: float,
    title: str,
    description: str,
    evidence: str,
    scene_ids: Optional[list[str]] = None,
    character_ids: Optional[list[str]] = None,
    entity_name: Optional[str] = None,
    sources: Optional[list[dict[str, Any]]] = None,
    source_conflict: Optional[dict[str, Any]] = None,
) -> dict[str, bool]:
    """Tool the LLM calls to emit a candidate issue.

    Args are kept JSON-serializable (strings / numbers) so Gemini can call this
    as a function. The registry stores a typed IssueDraft.
    """
    try:
        typed_sources = [Source(**s) for s in (sources or [])]
    except Exception as exc:
        logger.warning("Invalid sources in flag_issue: %s", exc)
        typed_sources = []

    typed_source_conflict = None
    if source_conflict:
        try:
            typed_source_conflict = SourceConflict(**source_conflict)
        except Exception as exc:
            logger.warning("Invalid source_conflict in flag_issue: %s", exc)

    try:
        draft = IssueDraft(
            type=IssueType(issue_type),
            severity=Severity(severity),
            confidence=confidence,
            title=title,
            description=description,
            evidence=evidence,
            scene_ids=scene_ids or [],
            character_ids=character_ids or [],
            entity_name=entity_name,
            sources=typed_sources,
            source_conflict=typed_source_conflict,
        )
        registry.issues.append(draft)
        logger.info(
            "Flagged issue type=%s severity=%s title=%s",
            issue_type,
            severity,
            title,
        )
        return {"ok": True}
    except Exception as exc:
        logger.exception("Failed to flag issue")
        return {"ok": False, "error": str(exc)}


# ── Scene lookup ──


def get_scene(script: Script, scene_id: str) -> Optional[Scene]:
    """Return a scene from the in-memory Script payload by id."""
    for scene in script.scenes:
        if scene.id == scene_id:
            return scene
    return None


# ── Parallel Search stub ──


def search_parallel(query: str, objective: str) -> dict[str, Any]:
    """Stub for the Parallel Search API.

    Returns a canned 'no results' shape that matches the expected response
    structure so callers can build against it. Module 6 will swap this body for
    a real `parallel-web` SDK call.
    """
    logger.info("Parallel search stub called: query=%r objective=%r", query, objective)
    return {
        "query": query,
        "objective": objective,
        "results": [],
        "summary": "No live search performed (Module 4 stub).",
    }


# ── Gemini function declarations ──


FLAG_ISSUE_DECLARATION = {
    "name": "flag_issue",
    "description": (
        "Emit a candidate script continuity or factual issue. Only call this "
        "when you have identified a concrete problem with supporting evidence "
        "from the script. Always cite every scene involved."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "issue_type": {
                "type": "string",
                "enum": [
                    "continuity_prop",
                    "continuity_wardrobe",
                    "continuity_injury",
                    "timeline",
                    "geography",
                    "character_knowledge",
                    "external_fact",
                    "ambiguous",
                    "unverifiable",
                ],
                "description": "Category of the issue.",
            },
            "severity": {
                "type": "string",
                "enum": ["critical", "high", "medium", "low"],
                "description": "Audience-visible impact of the issue.",
            },
            "confidence": {
                "type": "number",
                "minimum": 0,
                "maximum": 1,
                "description": "Model confidence in this issue (0.0 to 1.0).",
            },
            "title": {
                "type": "string",
                "description": "Short, specific title for the issue.",
            },
            "description": {
                "type": "string",
                "description": "Plain-language explanation of the problem.",
            },
            "evidence": {
                "type": "string",
                "description": "Quoted or paraphrased conflicting lines from the script.",
            },
            "scene_ids": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Ids of every scene involved in the contradiction.",
            },
            "character_ids": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Ids of characters involved, if any.",
            },
            "entity_name": {
                "type": "string",
                "nullable": True,
                "description": "The prop, place, character name, or claim at the center of the issue.",
            },
        },
        "required": [
            "issue_type",
            "severity",
            "confidence",
            "title",
            "description",
            "evidence",
            "scene_ids",
        ],
    },
}


SEARCH_PARALLEL_DECLARATION = {
    "name": "search_parallel",
    "description": (
        "Search the real world for evidence about a claim made in the script. "
        "Use this for historical dates, technology, geography, or named facts."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search query.",
            },
            "objective": {
                "type": "string",
                "description": "What you are trying to verify (e.g. 'confirm this date').",
            },
        },
        "required": ["query", "objective"],
    },
}