"""Layer 2: external verification using the Parallel Search API.

Flow:
1. A targeted LLM pass extracts verifiable real-world claims from the script.
2. The model is forced to call `search_parallel` for each claim it flags.
3. Search results are normalized to Source objects.
4. A verdict is derived: confirm / dispute / unverifiable.
5. An IssueDraft is emitted for every disputed or unverifiable claim.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from google.genai.types import Tool, ToolConfig

from app.gemini import generate, parse_function_calls
from app.models import AnalyzeAgentRequest, IssueDraft, IssueType, Script
from app.tools import SEARCH_PARALLEL_DECLARATION, IssueRegistry, flag_issue, search_parallel

logger = logging.getLogger(__name__)


CLAIM_EXTRACTION_PROMPT = """You are Ross, a script fact-checker.

Read the screenplay below and identify claims that can be checked against the
real world. Focus on:
- historical dates or events
- technology claims (was this invented yet?)
- period-accuracy of named props, vehicles, weapons, or devices
- real place names and their stated geography

For each verifiable claim you find, you MUST call the `search_parallel` tool.
Do not skip a claim silently. If you find no verifiable claims, reply with a
short statement that no claims were found.

Each `search_parallel` call should include:
- query: a concise web search query
- objective: what you are trying to verify (e.g. 'confirm this existed in 1985')
- scene_id: the id of the scene where the claim appears (use the exact `id: ...` value)
"""

VERDICT_PROMPT = """You are a fact-checking analyst.

Claim from the script: {claim_text}

Search results:
{results_text}

Determine the verdict:
- confirm: the sources support the claim
- dispute: the sources contradict the claim
- unverifiable: not enough evidence to call it either way

Reply ONLY with one of: confirm, dispute, unverifiable.
"""

_SEARCH_TOOL = Tool(function_declarations=[SEARCH_PARALLEL_DECLARATION])

# Force the model to call search_parallel for any claim it extracts.
_FORCED_SEARCH_CONFIG = ToolConfig(
    function_calling_config={
        "mode": "ANY",
        "allowed_function_names": ["search_parallel"],
    }
)


def _serialize_script_for_claims(script: Script) -> str:
    """Return a compact text of the script suitable for claim extraction."""
    lines: list[str] = []
    lines.append(f"Title: {script.title}")
    lines.append(f"Format: {script.format.value}")
    lines.append("")
    for scene in script.scenes:
        lines.append(f"--- Scene {scene.number} (id: {scene.id}) ---")
        for line in scene.lines:
            lines.append(f"[{line.type.value}] {line.text}")
        lines.append("")
    return "\n".join(lines)


def _extract_claims(script: Script) -> list[dict[str, Any]]:
    """Use Gemini to extract verifiable claims and forced search calls."""
    user_prompt = (
        "Identify verifiable real-world claims in the following screenplay. "
        "Call the search_parallel tool for each claim.\n\n"
        "=== SCREENPLAY ===\n"
        f"{_serialize_script_for_claims(script)}"
    )

    try:
        response = generate(
            system_prompt=CLAIM_EXTRACTION_PROMPT,
            user_prompt=user_prompt,
            tools=[_SEARCH_TOOL],
            tool_config=_FORCED_SEARCH_CONFIG,
        )
    except Exception:
        logger.exception("Layer 2 claim extraction failed")
        return []

    calls = parse_function_calls(response)
    logger.info("Layer 2 extracted %d search calls", len(calls))

    claims: list[dict[str, Any]] = []
    for call in calls:
        if call.get("name") != "search_parallel":
            continue
        args = call.get("args", {})
        claims.append(
            {
                "query": args.get("query", ""),
                "objective": args.get("objective", ""),
                "scene_id": args.get("scene_id", ""),
            }
        )
    return claims


def _build_sources(search_result: dict[str, Any]) -> list[dict[str, Any]]:
    """Convert a normalized search result into Source-compatible dicts."""
    now = datetime.now(timezone.utc).isoformat()
    sources: list[dict[str, Any]] = []
    for result in search_result.get("results", []):
        sources.append(
            {
                "url": result.get("url", ""),
                "title": result.get("title", "Untitled"),
                "snippet": result.get("snippet", ""),
                "supportsVerdict": result.get("supports_verdict", True),
                "retrievedAt": now,
            }
        )
    return sources


def _derive_verdict(sources: list[dict[str, Any]], claim_text: str) -> str:
    """Use Gemini to derive confirm/dispute/unverifiable from sources."""
    if not sources:
        return "unverifiable"

    results_text = "\n\n".join(
        f"Source: {s.get('title', 'Untitled')}\n{s.get('snippet', '')}"
        for s in sources
    )

    user_prompt = VERDICT_PROMPT.format(
        claim_text=claim_text,
        results_text=results_text,
    )

    try:
        response = generate(
            system_prompt="You reply only with one word: confirm, dispute, or unverifiable.",
            user_prompt=user_prompt,
            temperature=0.0,
            max_output_tokens=10,
        )
    except Exception:
        logger.exception("Layer 2 verdict derivation failed")
        return "unverifiable"

    text = (response.text or "").strip().lower()
    if "disput" in text:
        return "dispute"
    if "confirm" in text:
        return "confirm"
    return "unverifiable"


def _build_conflict(sources: list[dict[str, Any]]) -> Optional[dict[str, Any]]:
    """Return a SourceConflict dict if sources disagree."""
    supporting = sum(1 for s in sources if s.get("supportsVerdict"))
    disputing = len(sources) - supporting
    if sources and supporting > 0 and disputing > 0:
        return {
            "supportingCount": supporting,
            "disputingCount": disputing,
            "summary": (
                f"Sources are split: {supporting} support the claim and "
                f"{disputing} dispute it."
            ),
        }
    return None


def run_layer2(request: AnalyzeAgentRequest) -> list[IssueDraft]:
    """Run external verification and return IssueDrafts for disputed/unverifiable claims."""
    script = request.script
    logger.info("Layer 2 start: scenes=%d", len(script.scenes))

    claims = _extract_claims(script)
    if not claims:
        logger.info("Layer 2 found no verifiable claims")
        return []

    registry = IssueRegistry()
    now = datetime.now(timezone.utc).isoformat()

    for claim in claims:
        query = claim.get("query", "")
        objective = claim.get("objective", "")
        scene_id = claim.get("scene_id", "")
        if not query or not objective:
            continue

        search_result = search_parallel(query, objective)
        sources = _build_sources(search_result)
        verdict = _derive_verdict(sources, claim_text=query)

        logger.info(
            "Layer 2 claim=%r verdict=%s sources=%d scene_id=%s",
            query,
            verdict,
            len(sources),
            scene_id,
        )

        if verdict == "confirm":
            continue

        if verdict == "dispute":
            issue_type = IssueType.external_fact
            severity = "high"
            title = f"Possible factual error: {query}"
            description = (
                f"The script's claim appears to be contradicted by external sources. "
                f"Objective: {objective}."
            )
            confidence = 0.85
        else:  # unverifiable
            issue_type = IssueType.unverifiable
            severity = "low"
            title = f"Unverifiable claim: {query}"
            description = (
                f"The script makes a real-world claim that could not be verified. "
                f"Objective: {objective}."
            )
            confidence = 0.5

        source_conflict = _build_conflict(sources)
        issue_scene_ids = [scene_id] if scene_id else []

        flag_issue(
            registry=registry,
            issue_type=issue_type.value,
            severity=severity,
            confidence=confidence,
            title=title,
            description=description,
            evidence=query,
            scene_ids=issue_scene_ids,
            entity_name=query,
            sources=sources,
            source_conflict=source_conflict,
        )

    logger.info("Layer 2 emitted %d issues", len(registry.issues))
    return registry.issues
