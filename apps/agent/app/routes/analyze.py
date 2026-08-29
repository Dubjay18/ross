"""Agent analysis routes: /analyze and /recheck.

Both routes accept an AnalyzeAgentRequest and return an AnalyzeAgentResponse.
The shared handler runs internal continuity checks, external verification, and
merge/dedup/severity ranking before returning the final issue list.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status
from pydantic import ValidationError

from app.continuity.continuity import run_continuity
from app.merge import merge_issues
from app.models import AnalyzeAgentRequest, AnalyzeAgentResponse
from app.verification.verification import run_verification

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["analyze"])


def _handle_analyze(payload: AnalyzeAgentRequest) -> AnalyzeAgentResponse:
    """Shared handler for full and partial analysis.

    Runs internal continuity checks, external (Parallel) verification, then
    merges/dedupes/ranks the combined IssueDraft list before returning.
    """
    logger.info(
        "Processing %s analysis for script=%s scene_count=%d focus_scenes=%d",
        payload.mode,
        payload.script.id,
        len(payload.script.scenes),
        len(payload.scene_ids),
    )

    if payload.mode == "partial" and not payload.scene_ids:
        logger.warning("Partial analysis requested without scene_ids")

    continuity_issues = run_continuity(payload)
    verification_issues = run_verification(payload)
    merged_issues = merge_issues(continuity_issues + verification_issues, payload.script)
    return AnalyzeAgentResponse(issues=merged_issues)


@router.post("/analyze", response_model=AnalyzeAgentResponse)
def analyze(payload: AnalyzeAgentRequest) -> AnalyzeAgentResponse:
    try:
        return _handle_analyze(payload)
    except HTTPException:
        raise
    except ValidationError as exc:
        logger.exception("Validation error during /analyze")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.errors(),
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error during /analyze")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": str(exc)},
        ) from exc


@router.post("/recheck", response_model=AnalyzeAgentResponse)
def recheck(payload: AnalyzeAgentRequest) -> AnalyzeAgentResponse:
    """Incremental recheck.

    Forces mode to 'partial' and delegates to the same handler. The API is
    responsible for computing affected sceneIds and passing them in.
    """
    payload.mode = "partial"
    try:
        return _handle_analyze(payload)
    except HTTPException:
        raise
    except ValidationError as exc:
        logger.exception("Validation error during /recheck")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.errors(),
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error during /recheck")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": str(exc)},
        ) from exc