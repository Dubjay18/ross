#!/usr/bin/env python3
"""Hard gate: minimal google-genai generateContent call."""

from __future__ import annotations

import os
import sys


def main() -> int:
    api_key = os.environ.get("GOOGLE_API_KEY", "").strip()
    if not api_key:
        print("FAIL: GOOGLE_API_KEY is not set", file=sys.stderr)
        return 1

    try:
        from google import genai
    except ImportError as exc:
        print(f"FAIL: google-genai not installed: {exc}", file=sys.stderr)
        return 1

    client = genai.Client(api_key=api_key)
    model = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")  # NOTE: The model gemini-2.0-flash is no longer available. Use gemini-3.6-flash or gemini-3.5-turbo instead.

    try:
        response = client.models.generate_content(
            model=model,
            contents="Reply with exactly the two characters: OK",
        )
    except Exception as exc:  # noqa: BLE001
        print(f"FAIL: Gemini generate error: {exc}", file=sys.stderr)
        return 1

    text = (getattr(response, "text", None) or str(response)).strip()
    print(f"ok: Gemini responded via {model}")
    print(f"text: {text[:200]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
