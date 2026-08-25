#!/usr/bin/env python3
"""Hard gate: Parallel Search API via official parallel-web SDK."""

from __future__ import annotations

import os
import sys


def main() -> int:
    api_key = os.environ.get("PARALLEL_API_KEY", "").strip()
    if not api_key:
        print("FAIL: PARALLEL_API_KEY is not set", file=sys.stderr)
        return 1

    try:
        from parallel import Parallel
    except ImportError as exc:
        print(f"FAIL: parallel-web not installed: {exc}", file=sys.stderr)
        return 1

    client = Parallel(api_key=api_key)
    query = "When was the Berlin Wall opened (year)?"
    print(f"query: {query}")

    try:
        result = client.search(
            search_queries=[query],
            objective="Verify the historical year the Berlin Wall was opened to free passage.",
            mode="fast",
            max_chars_total=4000,
        )
    except Exception as exc:  # noqa: BLE001 — smoke test surfaces any SDK/API failure
        print(f"FAIL: Parallel search error: {exc}", file=sys.stderr)
        return 1

    # Best-effort inspection across SDK response shapes
    results = getattr(result, "results", None) or getattr(result, "data", None) or result
    count = 0
    if isinstance(results, list):
        count = len(results)
    elif hasattr(results, "__iter__") and not isinstance(results, (str, bytes, dict)):
        try:
            count = len(list(results))
        except TypeError:
            count = 1
    else:
        count = 1 if results is not None else 0

    print(f"ok: Parallel Search responded (items≈{count})")
    print(f"result_type: {type(result).__name__}")
    preview = str(result)
    if len(preview) > 500:
        preview = preview[:500] + "…"
    print(f"preview: {preview}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
