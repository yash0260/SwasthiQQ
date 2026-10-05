"""
main.py — FastAPI application exposing POST /agent/run

Also exposes helper endpoints used by the React frontend:
  GET /conversations         — list all result files from results/
  GET /conversations/{id}    — get a specific result
  POST /agent/run            — the graded endpoint
"""

from __future__ import annotations

import json
import os
import pathlib
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel, field_validator

import agent as ag

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

app = FastAPI(
    title="SwasthiQ Front Desk Agent",
    description="Clinic appointment booking agent — schema.md compatible",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

RESULTS_DIR = pathlib.Path(__file__).parent / "results"
RESULTS_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# OpenAI client (singleton)
# ---------------------------------------------------------------------------

def _get_client() -> OpenAI:
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured.")
    return OpenAI(
        api_key=GEMINI_API_KEY,
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class RunRequest(BaseModel):
    conversation_id: str
    today: str  # YYYY-MM-DD
    turns: list[str]

    @field_validator("today")
    @classmethod
    def validate_today(cls, v: str) -> str:
        from datetime import date
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError(f"today must be YYYY-MM-DD, got '{v}'")
        return v

    @field_validator("turns")
    @classmethod
    def validate_turns(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("turns must not be empty")
        return v


class ToolCallOut(BaseModel):
    name: str
    arguments: dict[str, Any]


class RunResponse(BaseModel):
    conversation_id: str
    tool_calls: list[ToolCallOut]
    terminal_state: str
    escalation_reason: str | None
    patient_id: str | None
    appointment_id: str | None
    reply: str
    metrics: dict[str, int]


# ---------------------------------------------------------------------------
# POST /agent/run  — the graded endpoint
# ---------------------------------------------------------------------------

@app.post("/agent/run", response_model=RunResponse)
def agent_run(req: RunRequest):
    client = _get_client()

    result = ag.run_agent(
        conversation_id=req.conversation_id,
        today=req.today,
        turns=req.turns,
        openai_client=client,
        model=GEMINI_MODEL,
    )

    response = RunResponse(
        conversation_id=req.conversation_id,
        tool_calls=[ToolCallOut(name=tc["name"], arguments=tc["arguments"]) for tc in result.tool_calls],
        terminal_state=result.terminal_state,
        escalation_reason=result.escalation_reason,
        patient_id=result.patient_id,
        appointment_id=result.appointment_id,
        reply=result.reply,
        metrics={
            "turns": len(req.turns),
            "tokens": result.tokens,
            "latency_ms": result.latency_ms,
        },
    )

    # Persist result for the frontend
    _save_result(req.conversation_id, req.turns, response)

    return response


def _save_result(conversation_id: str, turns: list[str], response: RunResponse):
    """Save the result to results/ for the frontend to read."""
    data = response.model_dump()
    data["turns_input"] = turns
    dest = RESULTS_DIR / f"{conversation_id}.json"
    with dest.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# GET /conversations  — list results for frontend
# ---------------------------------------------------------------------------

@app.get("/conversations")
def list_conversations():
    results = []
    for path in sorted(RESULTS_DIR.glob("*.json")):
        try:
            with path.open(encoding="utf-8") as fh:
                data = json.load(fh)
            results.append(data)
        except Exception:
            continue
    return {"conversations": results}


# ---------------------------------------------------------------------------
# GET /conversations/{conversation_id}  — single result
# ---------------------------------------------------------------------------

@app.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str):
    path = RESULTS_DIR / f"{conversation_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Conversation not found.")
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "model": GEMINI_MODEL}
