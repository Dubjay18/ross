"""Agent tools.

This module defines the functions the Gemini model can call during analysis,
plus helper utilities for looking up scenes and tracking emitted issues.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional

from parallel import Parallel

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


# ── Parallel Search ──


PARALLEL_API_KEY = os.getenv("PARALLEL_API_KEY")
if not PARALLEL_API_KEY:
    logger.warning(
        "PARALLEL_API_KEY is not set; Parallel Search calls will fail until configured."
    )

_parallel_client: Optional[Parallel] = None


def _get_parallel_client() -> Parallel:
    global _parallel_client
    if _parallel_client is None:
        if not PARALLEL_API_KEY:
            raise RuntimeError(
                "PARALLEL_API_KEY is not set; Parallel Search calls cannot be made."
            )
        _parallel_client = Parallel(api_key=PARALLEL_API_KEY)
    return _parallel_client


def search_parallel(query: str, objective: str) -> dict[str, Any]:
    """Call the Parallel Search API and return a normalized result dict.

    The returned dict has the shape:
        {
            "query": str,
            "objective": str,
            "results": [
                {
                    "title": str,
                    "url": str,
                    "snippet": str,
                    "supports_verdict": bool,
                },
                ...
            ],
            "summary": str | None,
        }
    """
    logger.info("Parallel search: query=%r objective=%r", query, objective)

    try:
        client = _get_parallel_client()
        response = client.search(
            search_queries=[query],
            objective=objective,
            mode="fast",
            max_chars_total=4000,
        )
    except Exception as exc:
        logger.exception("Parallel Search API call failed")
        return {
            "query": query,
            "objective": objective,
            "results": [],
            "summary": f"Search failed: {exc}",
        }

    # Defensive normalization across SDK response shapes.
    raw_results: list[Any] = []
    summary: Optional[str] = None

    if isinstance(response, dict):
        raw_results = response.get("results", [])
        summary = response.get("summary")
    else:
        raw_results = getattr(response, "results", None) or getattr(response, "data", None) or []
        summary = getattr(response, "summary", None)

    results: list[dict[str, Any]] = []
    for item in raw_results:
        if isinstance(item, dict):
            results.append(
                {
                    "title": item.get("title", "Untitled"),
                    "url": item.get("url", ""),
                    "snippet": item.get("snippet", item.get("content", "")),
                    "supports_verdict": item.get("supports_verdict", True),
                }
            )
        else:
            title = getattr(item, "title", "Untitled")
            url = getattr(item, "url", "")
            snippet = getattr(item, "snippet", getattr(item, "content", ""))
            supports_verdict = getattr(item, "supports_verdict", True)
            results.append(
                {
                    "title": title,
                    "url": url,
                    "snippet": snippet,
                    "supports_verdict": supports_verdict,
                }
            )

    return {
        "query": query,
        "objective": objective,
        "results": results,
        "summary": summary,
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
            "scene_id": {
                "type": "string",
                "description": "The id of the scene where this claim appears (the 'id: ...' value, not the scene number).",
            },
        },
        "required": ["query", "objective"],
    },
}
