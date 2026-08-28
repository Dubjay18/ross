"""Layer 1: internal continuity analysis over the full script.

This module sends the entire parsed Script to Gemini with instructions to flag
continuity errors as tool calls. Check families:

- continuity_prop: objects that appear, disappear, or move without on-page reason
- continuity_wardrobe / continuity_injury: costume or injury side changes
- timeline: day/night jumps, impossible travel time between adjacent scenes
- geography: contradictions in a location's stated properties
- character_knowledge: a character reacts to information they haven't learned yet

The model is asked to return issues via the `flag_issue` tool. Each issue must
cite every scene involved and include a plain-language evidence string.
"""

from __future__ import annotations

import logging
from typing import Optional

from google.genai.types import Tool

from app.gemini import generate, parse_function_calls
from app.models import AnalyzeAgentRequest, IssueDraft, Script
from app.tools import FLAG_ISSUE_DECLARATION, IssueRegistry, flag_issue

logger = logging.getLogger(__name__)

_FLAG_ISSUE_TOOL = Tool(function_declarations=[FLAG_ISSUE_DECLARATION])


SYSTEM_PROMPT = """You are Ross, a script-continuity analyst with the entire screenplay in context.

Your job is to read the full script and flag concrete internal consistency
problems that a writers' room would need to fix before shooting.

Check families (only emit an issue if you find a real contradiction):
1. continuity_prop — an object appears, disappears, or moves between scenes
   without an on-page reason.
2. continuity_wardrobe / continuity_injury — a character's clothing, a bandage,
   a cast, or an injury changes side or state without a story beat explaining it.
3. timeline — day/night or time-of-day jumps that don't add up, or impossible
   travel time between two locations in adjacent scenes.
4. geography — a location's stated properties contradict themselves across
   scenes (e.g. a house has a basement in scene 3 and no basement in scene 12).
5. character_knowledge — a character reacts to information they have not been
   shown learning yet.

Rules:
- Be specific. Quote or paraphrase the conflicting lines in `evidence`.
- Cite every scene involved in `scene_ids`, not just one. Use the exact scene id
  shown at the top of each scene block (e.g. `id: scene-2`), NOT the human-readable
  scene number (e.g. `Scene 2`).
- Use `character_ids` only when you are confident a specific character is involved.
- If something is genuinely ambiguous from the text, use type `ambiguous` and
  explain what is missing.
- Do not invent issues where the script gives a clear on-page explanation.
- Confidence should reflect how unambiguous the contradiction is: 0.9+ for clear
  contradictions, 0.5-0.7 for plausible but inference-heavy problems.

Call `flag_issue` once per issue you find. If you find no issues, simply state
that no issues were found in your final text response.
"""


def _serialize_script(script: Script, focus_scene_ids: Optional[set[str]] = None) -> str:
    """Convert a Script model into a compact screenplay-shaped text for the LLM.

    Scenes are numbered and include their heading, location, time-of-day, and
    every line with its type and character (if applicable). When
    focus_scene_ids is provided, those scenes are annotated so the model knows
    where to concentrate new-issue generation while still seeing the whole script.
    """
    lines: list[str] = []
    lines.append(f"Title: {script.title}")
    lines.append(f"Format: {script.format.value}")
    lines.append(f"Total scenes: {len(script.scenes)}")
    lines.append("")

    for scene in script.scenes:
        focus_marker = " [FOCUS]" if focus_scene_ids and scene.id in focus_scene_ids else ""
        lines.append(
            f"--- Scene {scene.number}{focus_marker} (id: {scene.id}) ---"
        )
        heading_parts = [scene.heading]
        if scene.location:
            heading_parts.append(f"Location: {scene.location}")
        if scene.time_of_day:
            heading_parts.append(f"Time: {scene.time_of_day}")
        lines.append(" | ".join(heading_parts))

        for line in scene.lines:
            prefix = f"  [{line.type.value}]"
            if line.character_id:
                prefix += f" {line.character_id}:"
            lines.append(f"{prefix} {line.text}")
        lines.append("")

    return "\n".join(lines)


def _build_user_prompt(script: Script, mode: str, scene_ids: list[str]) -> str:
    """Build the analysis prompt from the serialized script."""
    focus_scene_ids = set(scene_ids) if scene_ids else None
    body = _serialize_script(script, focus_scene_ids)

    instructions = [
        "Analyze the screenplay below for internal continuity and consistency problems.",
    ]

    if mode == "partial" and scene_ids:
        instructions.append(
            f"This is a PARTIAL recheck. Focus new issue generation on these "
            f"scene ids: {scene_ids}. Use the exact ids shown in the scene blocks "
            f"(e.g. id: scene-2). You still have the whole script for context, "
            f"but only flag new issues that touch the focus scenes unless you "
            f"discover a severe contradiction elsewhere that was previously missed."
        )
    else:
        instructions.append(
            "This is a FULL analysis. Scan the entire script for any continuity "
            "or consistency problem."
        )

    instructions.append(
        "For every concrete issue you find, call the flag_issue tool. "
        "If you find no issues, reply with a short statement that no issues were found."
    )

    return "\n\n".join(["\n".join(instructions), "=== SCREENPLAY ===", body])


def run_layer1(request: AnalyzeAgentRequest) -> list[IssueDraft]:
    """Run internal consistency analysis and return candidate IssueDrafts."""
    script = request.script
    mode = request.mode
    scene_ids = request.scene_ids

    logger.info(
        "Layer 1 start: mode=%s scenes=%d focus=%d",
        mode,
        len(script.scenes),
        len(scene_ids),
    )

    user_prompt = _build_user_prompt(script, mode, scene_ids)

    registry = IssueRegistry()

    response = generate(
        system_prompt=SYSTEM_PROMPT,
        user_prompt=user_prompt,
        tools=[_FLAG_ISSUE_TOOL],
    )

    calls = parse_function_calls(response)
    logger.info("Layer 1 received %d function calls", len(calls))

    for call in calls:
        if call.get("name") != "flag_issue":
            logger.warning("Ignoring unexpected function call: %s", call.get("name"))
            continue

        args = call.get("args", {})
        flag_issue(registry, **args)

    logger.info("Layer 1 emitted %d issues", len(registry.issues))
    return registry.issues