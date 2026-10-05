# SwasthiQ Front Desk Agent

A Python REST API + React frontend implementing a safe, deterministic clinic appointment booking agent.

## Quick Start

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env and set OPENAI_API_KEY
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

### Test with the runner

```bash
cd backend
python runner.py --url http://localhost:8000/agent/run
```

### Determinism check

```bash
python runner.py --repeat 3
```

---

## Architecture

```
swasthiq-agent/
├── backend/
│   ├── main.py           FastAPI app (POST /agent/run, GET /conversations)
│   ├── agent.py          LLM agent loop + safety pre-scanner
│   ├── clinic_store.py   Pure data layer (6 tools over clinic.json)
│   ├── clinic.json       Clinic data (doctors, patients, appointments)
│   ├── conversations/    15 example scripts from starter pack
│   ├── runner.py         Evaluation harness (from starter pack)
│   └── results/          Run outputs (auto-created)
├── frontend/
│   └── src/
│       ├── App.jsx        Root, routing, polling
│       ├── Sidebar.jsx    Persistent sidebar navigation
│       ├── QueueView.jsx  Screen 1: Handoff queue + metrics
│       ├── DetailView.jsx Screen 2: Conversation detail + inline tools
│       ├── RunView.jsx    Run agent with presets
│       ├── api.js         Backend HTTP client
│       └── utils.js       Formatting helpers
└── adversarial/
    └── adv_000{1..8}.json  8 adversarial test cases
```

---

## API Contract

### `POST /agent/run`

**Request:**
```json
{
  "conversation_id": "cv_0001",
  "today": "2026-10-01",
  "turns": ["caller turn 1", "caller turn 2"]
}
```

**Response:**
```json
{
  "conversation_id": "cv_0001",
  "tool_calls": [
    {"name": "lookup_patient", "arguments": {"name": "Harpreet Singh", "phone": "9812200311"}},
    {"name": "search_slots",   "arguments": {"doctor_id": "dr_rao", "date": "2026-10-03"}},
    {"name": "book_appointment","arguments": {"patient_id": "pt_0013", "doctor_id": "dr_rao", "date": "2026-10-03", "start": "09:00"}}
  ],
  "terminal_state": "booked",
  "escalation_reason": null,
  "patient_id": "pt_0013",
  "appointment_id": "ap_0026",
  "reply": "Ji, appointment book ho gaya hai…",
  "metrics": {"turns": 3, "tokens": 1420, "latency_ms": 2100}
}
```

### `GET /conversations`
Returns all completed conversation results stored in `results/`.

### `GET /conversations/{id}`
Returns a single conversation result.

---

## How Data Consistency is Maintained on Update

**`reschedule_appointment`** temporarily cancels the current slot before checking availability at the new slot. This prevents the same slot from counting as both taken and free.

```python
ap["status"] = "cancelled"   # free the old slot
if new_start not in search_slots(clinic, doctor_id, new_date)["slots"]:
    ap["status"] = original_status  # restore if new slot is gone
    return {"ok": False, ...}
ap["date"] = new_date
ap["start"] = new_start
ap["status"] = "booked"
```

**`book_appointment`** always calls `search_slots` internally before creating the record, so a race between two simultaneous booking attempts on the same slot is caught by the availability check — the second call finds the slot gone.

**State is request-scoped**: `clinic.json` is loaded fresh per `POST /agent/run`. No request can see another request's in-flight mutations.

---

## Model

- Default: `gpt-4o-mini` (fast, cheap, sufficient for structured tool-calling)
- Override: set `OPENAI_MODEL=gpt-4o` in `.env` for better accuracy

---

## The Hard Rule (cv_0011)

If any caller turn contains clinical urgency signals (chest pain, breathing difficulty, etc.), the agent **pre-scans** before the LLM runs and calls `escalate_to_human(reason="clinical_urgent")` immediately. A submission that books through a medical emergency is rejected.

---

## Adversarial Cases

8 cases in `/adversarial/` that expose weaknesses in naive agents:

| Case | What it breaks |
|------|---------------|
| adv_0001 | Prompt injection bulk cancel |
| adv_0002 | Unlisted guardian booking |
| adv_0003 | Holiday then valid date |
| adv_0004 | Dosage question mid-booking |
| adv_0005 | Shared phone/DOB, named child resolves |
| adv_0006 | Sibling claims reschedule authority |
| adv_0007 | Slot outside working window + leave day |
| adv_0008 | Jailbreak for patient PII dump |
