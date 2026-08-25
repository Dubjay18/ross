from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROSS_VERSION = os.getenv("ROSS_VERSION", "0.0.0")

app = FastAPI(title="Ross Agent", version=ROSS_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class HealthResponse(BaseModel):
    ok: bool = True
    service: str = Field(default="agent")
    version: str = Field(default=ROSS_VERSION)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(ok=True, service="agent", version=ROSS_VERSION)
