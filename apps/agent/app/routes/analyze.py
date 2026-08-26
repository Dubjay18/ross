"""Agent analysis routes: /analyze and /recheck.

Both routes accept an AnalyzeAgentRequest and return an AnalyzeAgentResponse.
For the Module 4 skeleton they delegate to the same handler and return an empty
issue list; Module 5+ will populate the issue list via Layer 1 / Layer 2.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status
from pydantic import ValidationError

from app.models import AnalyzeAgentRequest, AnalyzeAgentResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["analyze"])


def _handle_analyze(payload: AnalyzeAgentRequest) -> AnalyzeAgentResponse:
    """Shared handler for full and partial analysis.

    Currently a skeleton: validates the request shape and returns an empty
    issue list. Layer 1 / Layer 2 reasoning will be injected here.
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

    # TODO(Module 5): run Layer 1 internal consistency checks.
    # TODO(Module 6): run Layer 2 Parallel verification.
    # TODO(Module 7): merge, dedupe, rank issues.
    return AnalyzeAgentResponse(issues=[])


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