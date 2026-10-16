# Architecture

This describes the backend as of 2026-10-17 (after Riddle 2). Intended behavior is in [api-contract.md](api-contract.md); verification and gaps are in [status.md](status.md).

## Runtime and module map

The implemented service is synchronous FastAPI with SQLAlchemy and a Gemini client. It defaults to a repository-root SQLite database. A configured Postgres URL is rewritten to use the psycopg driver. FastAPI serves the built frontend bundle (`frontend/dist`) when present; `frontend/` currently holds the Vite scaffold.

| Area | Files | Responsibility |
| --- | --- | --- |
| Application lifecycle | `backend/app/main.py`, `db.py`, `migrations.py` | App factory, DB setup and additive schema upgrades, routers, optional SPA/static-file serving |
| Runtime configuration | `backend/app/config.py`, `.env.example` | Environment-backed settings and defaults |
| HTTP boundary | `backend/app/api/`, `schemas.py` | Validation, authorization dependencies, response shapes, commits |
| Domain values | `backend/app/domain.py` | Plain question/work/outcome types shared by rules, prompts, and evaluation |
| Persistence | `backend/app/models.py` | Class, quiz, student, evidence, diagnosis, hypothesis, follow-up, AI trace |
| Classroom services | `services/classrooms.py`, `students.py`, `sample.py`, `specs.py` | Quiz setup, safe student views, pending follow-ups, domain conversion |
| Interpretation | `services/normalizer.py`, `rule_matcher.py`, `pipeline.py`, `guardrails.py` | Correctness, rules, AI orchestration, evidence checks, follow-up decisions |
| Interpretation storage | `services/diagnosis_store.py`, `results.py` | Versioned diagnoses, teacher overrides, grouped teacher views |
| Model boundary | `backend/app/ai/client.py`, `prompts.py`, `schemas.py` | Gemini transport, versioned prompts, structured output |
| Access and abuse controls | `security.py`, `rate_limit.py`, `api/deps.py` | Token hashes, ownership, public/student rate limits |
| Verification | `backend/tests/` | Synthetic model doubles, API/pipeline tests, opt-in live checks |

## Request flow

```mermaid
flowchart TD
    A[Student submits answer, explanation, confidence] --> B[API validation, token ownership, rate limit]
    B --> C[Code normalizes answer and fixes correctness]
    C --> D[Rule interpretation plus Gemini analysis]
    D --> E[Output schema and quoted-evidence checks]
    E --> F{Enough supported evidence?}
    F -->|Yes| G[Persist response and diagnosis version]
    F -->|Unclear, first pass| H[Ask one follow-up and persist pending state]
    H --> I[Student reply re-runs analysis within its own request budget]
    I --> E
    F -->|Still unclear after reply| J[Persist not_sure for teacher review]
    D -->|AI unavailable| K[Persist honest rule-only fallback]
    G --> L[Teacher-only results, history, and trace]
    J --> L
    K --> L
```

The guardrail decision also tracks whether a follow-up is allowed, so the diagram's reply path cannot produce an unlimited sequence of questions. A teacher override always wins: a reply's AI re-read is stored only if the follow-up's diagnosis is still the latest version when it is saved. A reply whose processing never finishes stays resumable (`POST /api/follow-ups/{id}/resume`).

## Evidence and versions

- `Response` stores the original accepted answer, redacted explanation, confidence, and code-decided correctness. `(student_id, question_id)` is unique.
- `Diagnosis` is an interpretation version for a response. Its hypotheses, follow-up, and AI trace belong to that version. The current view selects the highest version.
- A student's follow-up reply is stored on the original `FollowUp` (claimed with a conditional UPDATE and committed before the model call); a reread creates a new diagnosis. An override also creates a new diagnosis with `source=teacher`.
- Teacher response details combine original student work, current diagnosis, older versions, the follow-up exchange, and trace steps. Student serialization excludes those teacher-only fields.
- Versions are allocated as `MAX(version) + 1` under a row lock on the response (`SELECT … FOR UPDATE` on Postgres), with `UNIQUE(response_id, version)` as a backstop; writers retry on conflict.

## Decision and failure policy

Correctness comes from normalization, not Gemini. Numeric answers compare by rational value; text and choice answers use text normalization. The current choice implementation compares submitted option text, even though the older design spec says "choice by letter"; use the actual schema and contract when building the UI and resolve that wording if changing answer representation.

The AI proposes a label and competing hypotheses. Guardrails verify allowed labels, permitted misconception IDs, correctness-compatible interpretations, and quoted evidence. For a wrong answer the model must weigh every story (mistaken rule, missed condition, ran out of time, slip, guess) and list the rejected ones with a reason; code picks a story only if at least three were weighed and the chosen one leads the next by 0.2. "Ran out of time" comes only from recorded timing (timer auto-submit or the student's tick). Hypotheses are reconciled to one entry per story. Low certainty, unresolved disagreement or a close call leads to one follow-up. A confident label supported by a quote in the follow-up reply can rule out an initial answer-pattern interpretation. Otherwise, the second pass remains `not_sure` for teacher review.

The pipeline shares a configured 30-second budget across model calls within each request and passes remaining time to the Gemini client; each call is also capped by the configured 20-second limit. Less than two seconds remaining skips the model call. The frontend plan uses 45 seconds. These settings express the intended latency budget; verify real elapsed behavior under deployment/network failures before treating it as a hard end-to-end deadline.

Gemini errors, unusable structured output, and time exhaustion fall back to rules or a template follow-up. `AIRun` records metadata and parsed outcomes, rather than raw prompts. The health endpoint checks the DB and key presence; it does not call Gemini.

## Persistence and deployment boundaries

Startup runs `Base.metadata.create_all` for new tables, then `migrations.upgrade_schema` for additive column/index upgrades on existing databases (no data is dropped). The module-level engine/session factory assumes a single configured database per running service. Rate-limit state is held in process memory.

The intended deployment serves React and `/api` from one origin. A Dockerfile, `render.yaml` and smoke scripts exist; the React app is still the scaffold. Do not infer deployment readiness from the existing SPA-serving tests or from the hosting instructions alone.
