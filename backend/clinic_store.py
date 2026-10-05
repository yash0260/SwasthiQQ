"""
clinic_store.py — Pure, stateless data layer over clinic.json.

No LLM logic here. Every function is deterministic and side-effect-free
(except the mutating ones which operate on the passed-in state dict).

The six tools exposed match schema.md exactly:
  search_slots, book_appointment, reschedule_appointment,
  cancel_appointment, lookup_patient, escalate_to_human
"""

from __future__ import annotations

import copy
import json
import pathlib
from datetime import date, datetime, timedelta
from typing import Any

CLINIC_JSON = pathlib.Path(__file__).parent / "clinic.json"

# ---------------------------------------------------------------------------
# Slot duration
# ---------------------------------------------------------------------------
SLOT_MINUTES = 15

# ---------------------------------------------------------------------------
# Loaders
# ---------------------------------------------------------------------------

def load_clinic() -> dict:
    """Return a fresh, deep-copied clinic state from disk. Call once per request."""
    with CLINIC_JSON.open(encoding="utf-8") as fh:
        return json.load(fh)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _date_to_dow(d: date) -> str:
    """Return abbreviated weekday e.g. 'Mon', 'Tue' …"""
    return d.strftime("%a")


def _time_to_minutes(t: str) -> int:
    """'09:30' → 570"""
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def _minutes_to_time(mins: int) -> str:
    """570 → '09:30'"""
    return f"{mins // 60:02d}:{mins % 60:02d}"


def _add_minutes(t: str, delta: int) -> str:
    return _minutes_to_time(_time_to_minutes(t) + delta)


def _is_holiday(clinic: dict, d: str) -> bool:
    return d in clinic["holidays"]


def _doctor_on_leave(doctor: dict, d: str) -> bool:
    return d in doctor.get("leave_dates", [])


def _get_doctor(clinic: dict, doctor_id: str) -> dict | None:
    for doc in clinic["doctors"]:
        if doc["id"] == doctor_id:
            return doc
    return None


def _booked_slots_on(clinic: dict, doctor_id: str, d: str) -> set[str]:
    """Return set of start-times that are already booked for doctor on date."""
    return {
        ap["start"]
        for ap in clinic["appointments"]
        if ap["doctor_id"] == doctor_id
        and ap["date"] == d
        and ap["status"] == "booked"
    }


def _generate_slots(window_start: str, window_end: str, slot_minutes: int) -> list[str]:
    """Generate all slot start-times within [window_start, window_end)."""
    slots = []
    cur = _time_to_minutes(window_start)
    end = _time_to_minutes(window_end)
    while cur + slot_minutes <= end:
        slots.append(_minutes_to_time(cur))
        cur += slot_minutes
    return slots


def _next_appointment_id(clinic: dict) -> str:
    existing = [ap["id"] for ap in clinic["appointments"]]
    nums = [int(ap_id.split("_")[1]) for ap_id in existing if ap_id.startswith("ap_")]
    next_num = max(nums, default=0) + 1
    return f"ap_{next_num:04d}"


# ---------------------------------------------------------------------------
# Tool 1: search_slots
# ---------------------------------------------------------------------------

def search_slots(clinic: dict, doctor_id: str, date_str: str) -> dict:
    """
    Return free slots for doctor_id on date_str.

    Returns:
        { "ok": True, "slots": ["09:00", "09:15", ...] }
        { "ok": False, "reason": "..." }
    """
    doctor = _get_doctor(clinic, doctor_id)
    if doctor is None:
        return {"ok": False, "reason": f"No doctor with id '{doctor_id}'."}

    try:
        d = date.fromisoformat(date_str)
    except ValueError:
        return {"ok": False, "reason": f"Invalid date '{date_str}'."}

    if _is_holiday(clinic, date_str):
        return {"ok": False, "reason": f"{date_str} is a clinic holiday."}

    if _doctor_on_leave(doctor, date_str):
        return {"ok": False, "reason": f"{doctor['name']} is on leave on {date_str}."}

    dow = _date_to_dow(d)
    windows = [w for w in doctor["windows"] if w["day"] == dow]
    if not windows:
        return {"ok": False, "reason": f"{doctor['name']} does not work on {dow}."}

    booked = _booked_slots_on(clinic, doctor_id, date_str)
    free: list[str] = []
    seen: set[str] = set()
    for window in windows:
        for slot in _generate_slots(window["start"], window["end"], SLOT_MINUTES):
            if slot not in booked and slot not in seen:
                free.append(slot)
                seen.add(slot)

    free.sort()
    return {"ok": True, "slots": free, "doctor": doctor["name"], "date": date_str}


# ---------------------------------------------------------------------------
# Tool 2: book_appointment
# ---------------------------------------------------------------------------

def book_appointment(
    clinic: dict,
    patient_id: str,
    doctor_id: str,
    date_str: str,
    start: str,
) -> dict:
    """
    Create a new appointment.  Mutates clinic["appointments"].

    Returns:
        { "ok": True, "appointment_id": "ap_XXXX", ... }
        { "ok": False, "reason": "..." }
    """
    # Validate patient
    patient = next((p for p in clinic["patients"] if p["id"] == patient_id), None)
    if patient is None:
        return {"ok": False, "reason": f"No patient with id '{patient_id}'."}

    # Validate doctor and availability
    slots_result = search_slots(clinic, doctor_id, date_str)
    if not slots_result.get("ok"):
        return {"ok": False, "reason": slots_result.get("reason", "Slot unavailable.")}

    if start not in slots_result["slots"]:
        return {"ok": False, "reason": f"Slot {start} on {date_str} is not available for {doctor_id}."}

    # Create appointment
    ap_id = _next_appointment_id(clinic)
    end = _add_minutes(start, SLOT_MINUTES)
    appointment = {
        "id": ap_id,
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "date": date_str,
        "start": start,
        "end": end,
        "status": "booked",
    }
    clinic["appointments"].append(appointment)
    doctor = _get_doctor(clinic, doctor_id)
    return {
        "ok": True,
        "appointment_id": ap_id,
        "patient_id": patient_id,
        "doctor": doctor["name"] if doctor else doctor_id,
        "date": date_str,
        "start": start,
        "end": end,
    }


# ---------------------------------------------------------------------------
# Tool 3: reschedule_appointment
# ---------------------------------------------------------------------------

def reschedule_appointment(
    clinic: dict,
    appointment_id: str,
    new_date: str,
    new_start: str,
) -> dict:
    """
    Move an existing appointment to new_date / new_start.
    Mutates the appointment record in-place.
    """
    ap = next((a for a in clinic["appointments"] if a["id"] == appointment_id), None)
    if ap is None:
        return {"ok": False, "reason": f"No appointment with id '{appointment_id}'."}
    if ap["status"] != "booked":
        return {"ok": False, "reason": f"Appointment {appointment_id} is not in 'booked' state."}

    doctor_id = ap["doctor_id"]
    slots_result = search_slots(clinic, doctor_id, new_date)
    if not slots_result.get("ok"):
        return {"ok": False, "reason": slots_result.get("reason", "New slot unavailable.")}

    # Temporarily free the current slot so it doesn't block itself
    original_date = ap["date"]
    original_start = ap["start"]
    original_status = ap["status"]

    ap["status"] = "cancelled"  # free the slot
    if new_start not in search_slots(clinic, doctor_id, new_date).get("slots", []):
        ap["status"] = original_status  # restore
        return {"ok": False, "reason": f"Slot {new_start} on {new_date} is not available."}

    ap["date"] = new_date
    ap["start"] = new_start
    ap["end"] = _add_minutes(new_start, SLOT_MINUTES)
    ap["status"] = "booked"

    doctor = _get_doctor(clinic, doctor_id)
    return {
        "ok": True,
        "appointment_id": appointment_id,
        "old_date": original_date,
        "old_start": original_start,
        "new_date": new_date,
        "new_start": new_start,
        "doctor": doctor["name"] if doctor else doctor_id,
    }


# ---------------------------------------------------------------------------
# Tool 4: cancel_appointment
# ---------------------------------------------------------------------------

def cancel_appointment(clinic: dict, appointment_id: str) -> dict:
    """Cancel an existing booked appointment."""
    ap = next((a for a in clinic["appointments"] if a["id"] == appointment_id), None)
    if ap is None:
        return {"ok": False, "reason": f"No appointment with id '{appointment_id}'."}
    if ap["status"] != "booked":
        return {"ok": False, "reason": f"Appointment {appointment_id} is already cancelled."}

    ap["status"] = "cancelled"
    doctor = _get_doctor(clinic, ap["doctor_id"])
    return {
        "ok": True,
        "appointment_id": appointment_id,
        "patient_id": ap["patient_id"],
        "date": ap["date"],
        "start": ap["start"],
        "doctor": doctor["name"] if doctor else ap["doctor_id"],
    }


# ---------------------------------------------------------------------------
# Tool 5: lookup_patient
# ---------------------------------------------------------------------------

def lookup_patient(
    clinic: dict,
    name: str | None = None,
    phone: str | None = None,
) -> dict:
    """
    Resolve a caller to patient record(s).

    Returns ALL matching candidates. Never guesses.
    The caller must supply at least a name or a phone.

    Matching:
    - phone is exact
    - name: case-insensitive partial/prefix match on full name tokens
    """
    if not name and not phone:
        return {"ok": False, "reason": "Provide at least a name or phone number."}

    candidates = list(clinic["patients"])

    if phone:
        phone_clean = phone.strip().replace(" ", "").replace("-", "")
        candidates = [p for p in candidates if p["phone"] == phone_clean]

    if name:
        name_lower = name.strip().lower()
        name_tokens = set(name_lower.split())
        filtered = []
        for p in candidates:
            patient_name_lower = p["name"].lower()
            patient_tokens = set(patient_name_lower.split())
            # Match if ALL query tokens appear in patient tokens (prefix-friendly)
            if all(
                any(pt.startswith(nt) for pt in patient_tokens)
                for nt in name_tokens
            ):
                filtered.append(p)
        candidates = filtered

    if not candidates:
        return {"ok": False, "reason": "No patient found matching the given details."}

    return {
        "ok": True,
        "count": len(candidates),
        "candidates": [
            {
                "id": p["id"],
                "name": p["name"],
                "phone": p["phone"],
                "dob": p["dob"],
                "guardian_of": p.get("guardian_of", []),
            }
            for p in candidates
        ],
    }


# ---------------------------------------------------------------------------
# Tool 6: escalate_to_human
# ---------------------------------------------------------------------------

VALID_ESCALATION_REASONS = {
    "clinical_urgent",
    "medical_advice",
    "not_authorised",
    "ambiguous_patient",
    "out_of_scope",
}


def escalate_to_human(reason: str, note: str = "") -> dict:
    """
    Signal that the conversation must be handed off to a human.
    reason must be one of the five valid escalation_reason values.
    """
    if reason not in VALID_ESCALATION_REASONS:
        return {
            "ok": False,
            "reason_error": (
                f"Invalid escalation reason '{reason}'. "
                f"Valid: {sorted(VALID_ESCALATION_REASONS)}"
            ),
        }
    return {"ok": True, "escalation_reason": reason, "note": note}


# ---------------------------------------------------------------------------
# Helper: get patient's appointments
# ---------------------------------------------------------------------------

def get_patient_appointments(
    clinic: dict,
    patient_id: str,
    date_str: str | None = None,
    doctor_id: str | None = None,
) -> list[dict]:
    """Return booked appointments for a patient, optionally filtered."""
    results = [
        ap for ap in clinic["appointments"]
        if ap["patient_id"] == patient_id and ap["status"] == "booked"
    ]
    if date_str:
        results = [ap for ap in results if ap["date"] == date_str]
    if doctor_id:
        results = [ap for ap in results if ap["doctor_id"] == doctor_id]
    return results
