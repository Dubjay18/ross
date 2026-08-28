"""Unit tests for Layer 2 external verification logic.

These tests avoid network calls by monkeypatching `app.layer2.verification.search_parallel`
and `app.layer2.verification._extract_claims`. Verdict derivation still calls
`generate`, so that is also patched.
"""

from __future__ import annotations

import os
import sys
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.layer2 import verification as layer2
from app.models import AnalyzeAgentRequest
from tests.fixtures import make_planted_prop_script


def _make_search_result(sources: list[dict]) -> dict:
    return {
        "query": "test query",
        "objective": "test objective",
        "results": sources,
        "summary": "mock summary",
    }


def _make_generate_response(text: str) -> SimpleNamespace:
    return SimpleNamespace(text=text, candidates=None, function_calls=None)


def test_build_conflict_when_sources_disagree():
    sources = [
        {"supportsVerdict": True, "title": "A", "snippet": "yes"},
        {"supportsVerdict": False, "title": "B", "snippet": "no"},
    ]
    conflict = layer2._build_conflict(sources)
    assert conflict is not None
    assert conflict["supportingCount"] == 1
    assert conflict["disputingCount"] == 1


def test_build_conflict_when_sources_agree():
    sources = [
        {"supportsVerdict": True, "title": "A", "snippet": "yes"},
        {"supportsVerdict": True, "title": "B", "snippet": "also yes"},
    ]
    conflict = layer2._build_conflict(sources)
    assert conflict is None


def test_build_sources_converts_results():
    result = _make_search_result(
        [
            {"title": "Example", "url": "https://example.com", "snippet": "hello", "supports_verdict": True}
        ]
    )
    sources = layer2._build_sources(result)
    assert len(sources) == 1
    assert sources[0]["title"] == "Example"
    assert sources[0]["url"] == "https://example.com"
    assert sources[0]["supportsVerdict"] is True
    assert "retrievedAt" in sources[0]


def test_run_layer2_emits_disputed_issue():
    script = make_planted_prop_script()
    request = AnalyzeAgentRequest(script=script, mode="full")

    fake_claims = [
        {"query": "were smartphones available in 1980", "objective": "confirm year", "scene_id": "scene-prop-1"}
    ]
    fake_search = _make_search_result(
        [{"title": "T", "url": "https://t.com", "snippet": "no", "supports_verdict": False}]
    )

    with patch.object(layer2, "_extract_claims", return_value=fake_claims):
        with patch.object(layer2, "search_parallel", return_value=fake_search):
            with patch.object(layer2, "generate", return_value=_make_generate_response("dispute")):
                issues = layer2.run_layer2(request)

    assert issues
    assert any(issue.type.value == "external_fact" for issue in issues)
    assert all("scene-prop-1" in issue.scene_ids for issue in issues)


def test_run_layer2_emits_unverifiable_issue():
    script = make_planted_prop_script()
    request = AnalyzeAgentRequest(script=script, mode="full")

    fake_claims = [{"query": "mystery claim", "objective": "verify", "scene_id": "scene-prop-2"}]
    fake_search = _make_search_result([])

    with patch.object(layer2, "_extract_claims", return_value=fake_claims):
        with patch.object(layer2, "search_parallel", return_value=fake_search):
            with patch.object(layer2, "generate", return_value=_make_generate_response("unverifiable")):
                issues = layer2.run_layer2(request)

    assert issues
    assert any(issue.type.value == "unverifiable" for issue in issues)
    assert all("scene-prop-2" in issue.scene_ids for issue in issues)


def test_run_layer2_skips_confirmed_claim():
    script = make_planted_prop_script()
    request = AnalyzeAgentRequest(script=script, mode="full")

    fake_claims = [{"query": "confirmable claim", "objective": "verify", "scene_id": "scene-prop-1"}]
    fake_search = _make_search_result(
        [{"title": "T", "url": "https://t.com", "snippet": "yes", "supports_verdict": True}]
    )

    with patch.object(layer2, "_extract_claims", return_value=fake_claims):
        with patch.object(layer2, "search_parallel", return_value=fake_search):
            with patch.object(layer2, "generate", return_value=_make_generate_response("confirm")):
                issues = layer2.run_layer2(request)

    # Confirmed claims should not produce issues.
    assert not issues
