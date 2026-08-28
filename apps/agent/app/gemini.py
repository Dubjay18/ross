"""Thin wrapper around the google-genai SDK.

Centralizes model selection, API key handling, and error conversion so the
rest of the agent only deals with prompt text and responses.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional

from google import genai
from google.genai.types import (
    Content,
    GenerateContentConfig,
    GenerateContentResponse,
    Part,
    Tool,
    ToolConfig,
)

logger = logging.getLogger(__name__)

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

if not GOOGLE_API_KEY:
    logger.warning(
        "GOOGLE_API_KEY is not set; Gemini calls will fail until it is configured."
    )

_client: Optional[genai.Client] = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not GOOGLE_API_KEY:
            raise GeminiError(
                "GOOGLE_API_KEY is not set; Gemini calls cannot be made."
            )
        _client = genai.Client(api_key=GOOGLE_API_KEY)
    return _client


class GeminiError(Exception):
    """Raised when a Gemini call fails after all retries."""

    def __init__(self, message: str, cause: Optional[Exception] = None) -> None:
        super().__init__(message)
        self.cause = cause


def generate(
    system_prompt: str,
    user_prompt: str,
    tools: Optional[list[Tool]] = None,
    tool_config: Optional[ToolConfig] = None,
    temperature: float = 0.2,
    max_output_tokens: int = 4096,
) -> GenerateContentResponse:
    """Call Gemini with the configured model and return the raw response.

    Args:
        system_prompt: Instructions to the model.
        user_prompt: The actual content to analyze.
        tools: Optional function declarations for tool calling.
        tool_config: Optional tool-calling configuration (e.g. forced calls).
        temperature: Sampling temperature. Lower for deterministic analysis.
        max_output_tokens: Hard cap on response length.

    Returns:
        The full GenerateContentResponse from google-genai.

    Raises:
        GeminiError: if the API call fails.
    """
    logger.info(
        "Calling Gemini model=%s tools=%s temperature=%s",
        GEMINI_MODEL,
        bool(tools),
        temperature,
    )

    contents = [
        Content(role="user", parts=[Part.from_text(text=user_prompt)]),
    ]

    config = GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=temperature,
        max_output_tokens=max_output_tokens,
    )
    if tools:
        config.tools = tools
    if tool_config:
        config.tool_config = tool_config

    try:
        response = _get_client().models.generate_content(
            model=GEMINI_MODEL,
            contents=contents,
            config=config,
        )
        logger.info(
            "Gemini response finish_reason=%s tool_calls=%d",
            response.candidates[0].finish_reason if response.candidates else "none",
            len(response.function_calls or []),
        )
        return response
    except Exception as exc:
        logger.exception("Gemini generate_content failed")
        raise GeminiError(f"Gemini request failed: {exc}") from exc


def parse_function_calls(response: GenerateContentResponse) -> list[dict[str, Any]]:
    """Extract function-call arguments from a Gemini response.

    Returns a list of {"name": str, "args": dict} dictionaries. Empty list if
    the model made no tool calls.
    """
    calls: list[dict[str, Any]] = []
    for candidate in response.candidates or []:
        for part in candidate.content.parts or []:
            func_call = part.function_call
            if func_call is not None:
                calls.append(
                    {
                        "name": func_call.name,
                        "args": dict(func_call.args or {}),
                    }
                )
    return calls
