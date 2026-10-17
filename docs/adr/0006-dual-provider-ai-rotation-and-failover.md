# ADR 0006: Dual-Provider AI Key Rotation & Honest Fallback

* **Status:** Accepted
* **Date:** 2026-10-16
* **Deciders:** Shane Christian (Track A), Madhav Thesiya (Track C), Meet Virugama (Track B)
* **Target Components:** `backend/app/ai/client.py`, `backend/app/config.py`, `backend/app/services/pipeline.py`
* **Related Requirements:** Classroom Reliability, Latency Budgets, System Invariant #9 (Honest Fallback)

---

## Context

In an active school environment, an entire classroom of 30 students completes a check-in quiz simultaneously. When the teacher says "Submit", 30 rich diagnostic requests hit the backend within seconds.

This workload profile exposes two critical infrastructure vulnerabilities:
1. **Third-Party Rate Limits (HTTP 429):** Free and standard-tier LLM API keys typically enforce strict Requests-Per-Minute (RPM) and Tokens-Per-Minute (TPM) quotas. A single API key will inevitably saturate and fail on concurrent classroom bursts.
2. **Provider Outages & Network Delays:** Cloud AI APIs experience intermittent latency spikes and regional outages. If the assessment platform depends blindly on a single remote endpoint, a 10-second hang disrupts the lesson.
3. **The Unethical "Canned Fallback" Anti-Pattern:** Many educational AI prototypes respond to API failures by returning pre-fabricated, hardcoded "AI" responses to feign functionality. This breaches scientific and academic integrity.

---

## Decision

We designed a resilient **Multi-Key Dual-Provider Failover Architecture with Transparent Fallbacks**:

1. **Multi-Key Pool Rotation:**
   - The application accepts comma-delimited key pools for both Google Gemini (`GEMINI_API_KEYS`) and Groq (`GROQ_API_KEYS`).
   - Requests cycle across available keys using round-robin distribution with exponential backoff on transient errors.

2. **Cross-Provider Failover:**
   - **Primary Engine:** Google Gemini (Gemini 2.5 Flash / Pro) providing deep reasoning and structured JSON output.
   - **Secondary Engine:** Groq (Llama 3.3 70B / 8B Versatile) providing ultra-low-latency fallback if Gemini endpoints experience consecutive HTTP 429/500 errors or latency spikes.

3. **Strict Per-Request Shared Latency Budget (`_Budget`):**
   - Each inbound HTTP submission is assigned a cumulative 30-second budget shared across all internal pipeline stages.
   - Individual model calls are capped at a strict 20-second timeout.
   - If the remaining request budget drops below 2.0 seconds, the pipeline skips remote AI inference entirely to guarantee the HTTP response returns to the client before network timeouts trigger.

4. **Honest Rule-Only Fallback (`source: rules`):**
   - If both AI providers are unreachable, exhausted, or timed out, the system falls back to deterministic rule-based heuristics (`services/rule_matcher.py`).
   - The diagnosis record explicitly stores `source: rules` and marks the AI trace as `fallback: true`.
   - The teacher dashboard visibly labels the result as **"Rule-based (AI Offline)"**, allowing teachers to inspect deterministic facts without deceptive, fake AI claims.

---

## Consequences

### Positive
- **100% Classroom Availability:** Simultaneous submissions from 30+ students are distributed across key pools without hitting rate-limit barriers.
- **Predictable Latency:** Per-request budget tracking ensures students are never left hanging on a frozen browser screen.
- **Academic Honesty:** Educators and evaluators can verify exactly which diagnoses were AI-generated and which were rule-derived.

### Negative / Trade-offs
- **Key Management:** Administrators/teachers configuring self-hosted instances must supply at least one valid Gemini key (though local offline testing functions fully via `NullAIClient`).
- **Heuristic Degradation:** Rule fallbacks cannot match the full linguistic nuance of Gemini on unconventional student writing styles, though correctness grading remains completely unaffected.

---

## Alternatives Considered

1. **Single Gemini Key with In-Memory Queue:**
   - *Rejected:* A 30-student burst queuing behind a single key at 15 RPM creates a 2-minute wait for the last student, disrupting the lesson pace.
2. **Mock AI Responses on Failure:**
   - *Rejected:* Categorically rejected as a violation of educational ethics and project invariant #9 ("Never substitute canned AI results").
