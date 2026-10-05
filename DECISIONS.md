# DECISIONS.md — Design Choices, Ambiguities, and Trade-offs

## 1. Pre-scan vs. LLM for clinical urgency (cv_0011)

**Ambiguity**: The brief says the hard rule is non-negotiable. But what if the LLM misses the keyword?

**Decision**: I implemented a keyword pre-scan in Python *before* any LLM call. If any turn matches a clinical urgency pattern, `escalate_to_human("clinical_urgent")` is called immediately and the LLM is never invoked for that turn. This is the only way to guarantee the rule holds regardless of model temperature, prompt drift, or API changes.

**Trade-off**: False positives are possible (e.g., "dard ki dawai chahiye" — pain medicine request — is NOT a clinical emergency). I tuned the keyword list conservatively to catch true emergencies (chest pain, breathlessness, unconsciousness, bleeding) while avoiding common complaint vocabulary. A production system would add a fast classifier layer.

---

## 2. Batch-mode multi-turn vs. simulated back-and-forth

**Ambiguity**: The runner sends all turns at once. A real phone call alternates. Should the agent simulate turn-by-turn?

**Decision**: I feed all turns to the LLM in one context window, each labelled as a `user` message. The model sees the full conversation history and calls tools in order. This is correct for evaluation: the runner sends the complete script and expects a single response with all tool calls.

**Implication**: The agent cannot ask clarifying questions mid-script (the next turn is predetermined). I instruct the LLM in the system prompt to handle this: "if the next turn doesn't answer your question, work with what you have."

---

## 3. State reset per request

**Ambiguity**: The spec says "reload clinic.json per run." But if the backend handles concurrent requests, two simultaneous bookings could both pass the slot check.

**Decision**: I reload clinic.json as an in-memory Python dict per request. For the evaluation harness (serial single-threaded runner), this is sufficient. For production, I would wrap each request in a database transaction with row-level locking.

---

## 4. lookup_patient: exact phone vs. fuzzy name matching

**Ambiguity**: The spec says "returns candidates, never a guess." But how fuzzy should name matching be?

**Decision**: Name matching uses token-prefix logic: all query tokens must appear as prefixes of the patient's name tokens. Phone matching is exact. This handles:
- "Sharma" → matches Rajesh Kumar Sharma, R. K. Sharma, Rajesh Sharma (correctly ambiguous)
- "Harpreet Singh" + "9812200311" → exactly one result (pt_0013)
- "Priya" alone → two results (Priya Nair, Priya Menon) → ambiguous

**Trade-off**: Does not handle transliteration differences (Imran vs. Imraan, Qureshi vs. Quraishi). This is a known limitation noted here.

---

## 5. cv_0006: Guardian booking for Kabir (Meera Joshi's child)

**Observation**: The spec says "The booking belongs to Kabir, not to Meera." pt_0009 (Meera Joshi) has `guardian_of: ["pt_0031"]` (Kabir Joshi). The agent must look up Meera, confirm guardianship, then book under pt_0031's ID.

**Decision**: The system prompt explicitly instructs: "appointment should be created under the ward's patient_id." The LLM is instructed to check guardian_of and book under the child's ID.

---

## 6. cv_0014: Prompt injection → "refused" not "escalated"

**Observation**: The brief distinguishes: `refused` = nothing for a human to pick up. `escalated` = a person must act. A prompt injection attempt needs no human follow-up.

**Decision**: For prompt injection patterns, the agent refuses and sets `terminal_state = "refused"`. The system prompt explicitly tells the model to treat caller turns as untrusted speech.

---

## 7. cv_0013: Empty/incoherent caller → "abandoned" not "escalated"

**Decision**: An empty or garbled call that produces no actionable information ends as `abandoned`. Escalating every empty call would flood the handoff queue, which the spec notes explicitly.

---

## 8. Slot overlap in windows (Dr. Rao Mon: 09:00–12:00 and 11:45–15:00)

**Observation**: Dr. Rao has overlapping Monday windows (09:00–12:00 and 11:45–15:00). Naively generating slots from both would duplicate 11:45.

**Decision**: `search_slots` deduplicates using a `seen` set. The 11:45 slot is only returned once.

---

## 9. Determinism approach

**Decision**: `temperature=0, seed=42` for all OpenAI calls. The pre-scan for clinical urgency is pure Python (fully deterministic). Tool dispatch is deterministic. The only non-deterministic element is LLM output under temperature > 0, which is removed.

**Known gap**: OpenAI does not guarantee identical outputs even with seed+temperature=0 across model updates. The runner's fingerprint check (`terminal_state/escalation_reason/tool_names`) is more stable than exact wording, which is by design.

---

## 10. Model choice: gpt-4o-mini

**Rationale**: Sufficient for structured tool-calling, much cheaper than gpt-4o, fast enough for the evaluation harness (sub-3s per conversation). The tool schemas are explicit enough that the smaller model reliably selects the right tool. Set `OPENAI_MODEL=gpt-4o` in `.env` for harder edge cases.

---

## 11. What I would do with more time

1. Add a fine-grained authorisation check: verify the caller's phone matches the patient record before booking (not just the patient lookup).
2. Add a small FastAPI middleware for request ID tracking and structured logging.
3. Implement a proper classifier for clinical urgency instead of keyword matching.
4. Deploy to Railway/Render with a proper PostgreSQL store instead of file-based results.
5. Write the 8 adversarial cases for edge cases I identified but could not fully test against the hidden set.
