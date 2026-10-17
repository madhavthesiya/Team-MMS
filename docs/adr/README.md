# Architecture Decision Records (ADRs)

This directory documents the significant architectural and engineering decisions made during the design and implementation of **BehindTheMark**.

## Why We Use ADRs

BehindTheMark is an AI-augmented educational assessment platform where educational integrity, student privacy, and deterministic grading are non-negotiable. When building complex AI-assisted systems, design trade-offs must be recorded with explicit context, consequences, and alternatives considered so that any reviewer or contributor understands *why* the system is built this way.

Each record follows the standard Michael Nygard format:
1. **Title**: Numbered sequential identifier and clear decision title.
2. **Status**: `Accepted`, `Proposed`, `Superseded`, or `Deprecated`.
3. **Context**: The pedagogical and technical problem we were solving.
4. **Decision**: The architectural choice we made.
5. **Consequences**: The positive outcomes, trade-offs, and technical invariants maintained.
6. **Alternatives Considered**: Other approaches explored and why they were rejected.

---

## Index of Architectural Decisions

| ADR | Title | Status | Primary Invariant / Educational Riddle |
| :---: | :--- | :---: | :--- |
| [0001](0001-deterministic-code-grading.md) | **Deterministic Code-Based Grading** | Accepted | **Riddle 1:** AI never decides or changes `is_correct`. Only deterministic code grades answers. |
| [0002](0002-zero-pii-anonymous-sessions.md) | **Zero-PII Anonymous Student Sessions** | Accepted | **Security & Privacy:** No student accounts, emails, or PII. Ephemeral tokens and 6-letter join codes. |
| [0003](0003-competing-hypotheses-pipeline.md) | **Competing Hypotheses Pipeline & Timing Facts** | Accepted | **Riddle 2:** Multi-story weighing (`MIN_STORIES_WEIGHED`); server clock timing is immutable fact, never AI conjecture. |
| [0004](0004-surgical-single-followup.md) | **Surgical Single Follow-Up with Safe Decline** | Accepted | **Riddle 3:** Exactly $\le 1$ follow-up per question; zero-penalty decline; `SELECT FOR UPDATE` write-race safety. |
| [0005](0005-transfer-testing-across-time.md) | **Transfer Testing Across Situations and Time** | Accepted | **Riddle 4:** True conceptual understanding requires transfer to novel contexts and delayed re-testing (7-day gap). |
| [0006](0006-dual-provider-ai-rotation-and-failover.md) | **Dual-Provider AI Key Rotation & Honest Fallback** | Accepted | **Reliability & Ethics:** Multi-key Gemini + Groq rotation; guaranteed rule-only fallback without canned fake output. |

---

## Review & Compliance

All pull requests and code modifications must uphold the invariants recorded in these decisions. Any change to an accepted decision requires opening a superseding ADR.
