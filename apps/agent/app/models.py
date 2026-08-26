"""Domain models mirroring packages/shared Zod schemas (TS → Python)."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ── Enums ──


class LineType(str, Enum):
    dialogue = "dialogue"
    action = "action"
    direction = "direction"
    parenthetical = "parenthetical"
    transition = "transition"


class ScriptFormat(str, Enum):
    plaintext = "plaintext"
    fountain = "fountain"
    pdf = "pdf"
    fdx = "fdx"


class IssueType(str, Enum):
    continuity_prop = "continuity_prop"
    continuity_wardrobe = "continuity_wardrobe"
    continuity_injury = "continuity_injury"
    timeline = "timeline"
    geography = "geography"
    character_knowledge = "character_knowledge"
    external_fact = "external_fact"
    ambiguous = "ambiguous"
    unverifiable = "unverifiable"


class Severity(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class IssueStatus(str, Enum):
    open = "open"
    investigating = "investigating"
    confirmed = "confirmed"
    dismissed = "dismissed"
    resolved = "resolved"


class JobStatus(str, Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"


# ── Script models ──


class Character(BaseModel):
    id: str
    script_id: str = Field(alias="scriptId")
    name: str
    aliases: list[str] = []

    model_config = {"populate_by_name": True}


class Line(BaseModel):
    id: str
    scene_id: str = Field(alias="sceneId")
    type: LineType
    character_id: Optional[str] = Field(default=None, alias="characterId")
    text: str
    scene_heading: str = Field(alias="sceneHeading")

    model_config = {"populate_by_name": True}


class Scene(BaseModel):
    id: str
    script_id: str = Field(alias="scriptId")
    number: int
    heading: str
    location: Optional[str] = None
    time_of_day: Optional[str] = Field(default=None, alias="timeOfDay")
    lines: list[Line] = []
    character_ids: list[str] = Field(default_factory=list, alias="characterIds")

    model_config = {"populate_by_name": True}


class Script(BaseModel):
    id: str
    title: str
    raw_text: str = Field(alias="rawText")
    format: ScriptFormat = ScriptFormat.plaintext
    scenes: list[Scene] = []
    characters: list[Character] = []
    uploaded_at: datetime = Field(alias="uploadedAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = {"populate_by_name": True}


# ── Issue models ──


class Source(BaseModel):
    url: str
    title: str
    snippet: str
    supports_verdict: bool = Field(alias="supportsVerdict")
    retrieved_at: datetime = Field(alias="retrievedAt")

    model_config = {"populate_by_name": True}


class SourceConflict(BaseModel):
    supporting_count: int = Field(alias="supportingCount")
    disputing_count: int = Field(alias="disputingCount")
    summary: str

    model_config = {"populate_by_name": True}


class Issue(BaseModel):
    id: str
    script_id: str = Field(alias="scriptId")
    type: IssueType
    severity: Severity
    confidence: float = Field(ge=0.0, le=1.0)
    status: IssueStatus

    title: str
    description: str
    evidence: str

    scene_ids: list[str] = Field(default_factory=list, alias="sceneIds")
    character_ids: list[str] = Field(default_factory=list, alias="characterIds")
    entity_name: Optional[str] = Field(default=None, alias="entityName")

    sources: list[Source] = []
    source_conflict: Optional[SourceConflict] = Field(
        default=None, alias="sourceConflict"
    )

    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    resolved_at: Optional[datetime] = Field(default=None, alias="resolvedAt")
    dismissed_reason: Optional[str] = Field(default=None, alias="dismissedReason")
    recheck_count: int = Field(default=0, alias="recheckCount")
    last_recheck_at: Optional[datetime] = Field(default=None, alias="lastRecheckAt")

    model_config = {"populate_by_name": True}


# ── Job models ──


class AnalysisJob(BaseModel):
    id: str
    script_id: str = Field(alias="scriptId")
    status: JobStatus
    mode: str  # "full" | "partial"
    scene_ids: list[str] = Field(default_factory=list, alias="sceneIds")
    progress: Optional[float] = None
    error: Optional[str] = None
    created_at: datetime = Field(alias="createdAt")
    started_at: Optional[datetime] = Field(default=None, alias="startedAt")
    completed_at: Optional[datetime] = Field(default=None, alias="completedAt")

    model_config = {"populate_by_name": True}


# ── Lifecycle helpers ──

VALID_STATUS_TRANSITIONS: dict[IssueStatus, list[IssueStatus]] = {
    IssueStatus.open: [IssueStatus.investigating],
    IssueStatus.investigating: [
        IssueStatus.confirmed,
        IssueStatus.dismissed,
        IssueStatus.open,
    ],
    IssueStatus.confirmed: [IssueStatus.resolved, IssueStatus.open],
    IssueStatus.dismissed: [IssueStatus.open],
    IssueStatus.resolved: [IssueStatus.open],
}


def is_valid_transition(from_status: IssueStatus, to_status: IssueStatus) -> bool:
    return to_status in VALID_STATUS_TRANSITIONS.get(from_status, [])


SEVERITY_ORDER: dict[Severity, int] = {
    Severity.critical: 0,
    Severity.high: 1,
    Severity.medium: 2,
    Severity.low: 3,
}


def compare_severity(a: Severity, b: Severity) -> int:
    return SEVERITY_ORDER[a] - SEVERITY_ORDER[b]
