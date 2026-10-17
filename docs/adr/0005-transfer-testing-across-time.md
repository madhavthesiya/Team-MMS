# ADR 0005: Transfer Testing Across Situations and Time

* **Status:** Accepted
* **Date:** 2026-10-16
* **Deciders:** Shane Christian (Track A), Madhav Thesiya (Track C), Meet Virugama (Track B)
* **Target Components:** `backend/app/services/transfer.py`, `backend/app/api/transfer.py`, `backend/app/models.py`, `frontend/src/pages/TransferReview.tsx`
* **Related Requirements:** Riddle 4 ("Better Marks, Better Understanding?"), Pedagogical Validity

---

## Context

The central illusion of modern educational software is the conflation of **performance** with **learning**:
- A student attempts a quiz question, gets it wrong, reads an automated hint, re-attempts the exact same item 5 minutes later, and gets it right.
- The software generates a celebratory badge and records "Mastery Achieved".
- In reality, the student has merely memorized the superficial surface features, button positions, or specific numbers of that software interface. If asked to apply the same concept in a new context 7 days later, their performance collapses back to baseline.

We required a rigorous definition of **authentic conceptual mastery** that rejects superficial pattern matching and explicitly tests transfer across novel situations and time delays.

---

## Decision

We formalized the **Transfer Across Situations and Time Verification Model**:

1. **Transfer Across Context (Novel Situation):**
   - Learning can *never* be validated by re-testing the exact same question.
   - Verification requires an **Unaided Transfer Item**: a question assessing the identical underlying mathematical concept in an entirely different context (e.g., transitioning from a symbolic fraction addition formula to an area-model word problem or physical measurement).

2. **Strict Unaided Condition:**
   - The transfer re-check must be completed without hints, scaffolding, or AI follow-up prompts.
   - The student must produce both the correct answer and a written self-explanation demonstrating the target conceptual mechanism.
   - Deterministic rules grade the correctness; AI validates that the explanation articulates the core conceptual principle. A rule-only parse or right answer without explanation is classified as `unconvincing`.

3. **Temporal Retention Gap (`RECHECK_LASTING_DAYS = 7`):**
   - True understanding persists across time. The system measures the temporal delta ($\Delta t$) between initial failure and successful transfer:
     $$\Delta t = \text{timestamp}_{\text{transfer}} - \text{timestamp}_{\text{initial}}$$
   - If $\Delta t < 7 \text{ days}$, the understanding is classified as `travelled` (immediate transfer confirmed, but durability unverified).
   - If $\Delta t \ge 7 \text{ days}$, the understanding is elevated to `lasting` (enduring cognitive schema acquired).

4. **Actionable Pedagogical Remediation (`change_plan`):**
   - If the student fails the transfer item or exhibits persistent misconceptions, the platform does not simply instruct the teacher to "practice more".
   - The engine generates a concrete `change_plan` instructing the teacher to alter their instructional representation (e.g., *"Shift representation from symbolic notation to concrete visual bar models"*).

---

## Consequences

### Positive
- **Guaranteed Academic Validity:** The platform rejects superficial gaming and tool familiarity, providing teachers with honest diagnostic measurements.
- **Durable Learning Evidence:** Educators can distinguish between short-term cramming and genuine long-term conceptual retention.
- **Non-Destructive Storage:** Transfer checks are stored as distinct evidence records in the database; the original diagnostic history is permanently preserved for comparative trajectory analysis.

### Negative / Trade-offs
- **Delayed Validation:** Mastery cannot be claimed instantly within a single 30-minute session; it requires scheduling a spaced transfer check days later.
- **Authoring Overhead:** Teachers must pair foundational questions with transfer variants (alleviated by our AI Question & Misconception Generator in `QuizBuilder.tsx`).

---

## Alternatives Considered

1. **Immediate Same-Item Retest:**
   - *Rejected:* Tests short-term working memory and UI familiarity rather than transferable conceptual understanding.
2. **Numeric-Only Transfer Check:**
   - *Rejected:* A student can guess a new number correctly by chance; requiring a written conceptual explanation is necessary to eliminate false positives.
