# BehindTheMark — Backend API & Reasoning Engine

The backend for **BehindTheMark** is a high-performance FastAPI service designed for reliable classroom assessment, diagnostic reasoning, and multi-model AI failover.

---

## 1. Directory Structure & Key Modules

```text
backend/
├── app/
│   ├── main.py          # FastAPI application factory, CORS middleware, lifespan events
│   ├── config.py        # Pydantic BaseSettings, environment variables, multi-key getters
│   ├── db.py            # SQLAlchemy engine, session maker, SQLite/Postgres connection pool
│   ├── models.py        # 11 relational database tables (immutability & versioning)
│   ├── schemas.py       # Pydantic v2 request/response schemas matching API contract v1.5
│   ├── migrations.py    # Idempotent startup schema upgrades (preserves classroom data)
│   ├── rate_limit.py    # Split rate limiters (public IP vs authenticated student token)
│   ├── domain.py        # Pure dataclasses for reasoning pipeline and hypotheses
│   ├── api/             # Layered, thin HTTP routers
│   │   ├── classes.py   # Class CRUD, quiz updates, results, AI summary, AI generator
│   │   ├── students.py  # Join, session recovery, follow-up reply/decline, re-checks
│   │   ├── responses.py # Answer submission, teacher override, AI 1-on-1 intervention
│   │   └── health.py    # Service health endpoint (/api/health)
│   ├── services/        # Business logic & cognitive algorithms
│   │   ├── pipeline.py  # Core diagnostic pipeline (competing hypotheses evaluation)
│   │   ├── followups.py # Riddle 3 candidate filtering & shortest check selection
│   │   ├── transfer.py  # Riddle 4 transfer verification & retention re-checks
│   │   ├── results.py   # Aggregation of results by cognitive reason and story
│   │   ├── diagnosis_store.py # Concurrency locking (SELECT FOR UPDATE) & overrides
│   │   ├── ai_features.py # Implementation of 3 live teacher AI superpowers
│   │   └── normalizer.py  # Deterministic answer normalization (fractions, decimals, text)
│   └── ai/              # Multi-model client & prompt management
│       ├── client.py    # Dual rotation pools (Gemini + Groq) and composite failover
│       ├── prompts.py   # Versioned system prompts with strict JSON output schemas
│       └── schemas.py   # AI response schemas (AIFollowUp, AIIntervention, etc.)
└── tests/               # 175 offline automated unit, integration, and concurrency tests
    ├── fakes.py         # Quarantined mock doubles (TEST DOUBLE ONLY)
    ├── test_api.py      # HTTP endpoint contract verification
    ├── test_pipeline.py # Core diagnostic pipeline logic
    ├── test_riddle2_stories.py   # Competing hypotheses & timing story tests
    ├── test_riddle3_followups.py # Follow-up filtering, decline safety & predictions
    └── test_riddle4_transfer.py  # Unaided transfer items & 7-day retention checks
```

---

## 2. Core Architectural Invariants

1. **Deterministic Correctness:** Python code always evaluates `is_correct` (0 or 1). AI is strictly forbidden from altering answer correctness.
2. **Evidence Immutability:** Student submissions (`responses` table) and re-check attempts (`rechecks` table) are written once and never updated.
3. **Monotonic Diagnosis Versioning:** Every re-evaluation (via follow-up reply or teacher override) appends a new row in the `diagnoses` table (`UNIQUE(response_id, version)`).
4. **Teacher Supremacy & Write Races:** During simultaneous writes, `reply_to_follow_up` acquires a row lock (`SELECT ... FOR UPDATE`). If a teacher override arrived while the model call was in-flight, the late AI result is discarded, preserving teacher authority.
5. **Server-Clock Timing Facts:** "Ran out of time" is determined exclusively by server-recorded telemetry (`time_spent_seconds`, `timed_out`), never inferred by model guessing.
6. **Dual-Provider Key Rotation & Failover:** The backend rotates across pools of Google Gemini and Groq API keys with automated cross-provider failover. If all AI providers fail, it falls back to transparent rule heuristics labeled `source: rules`.

---

## 3. Running Backend Tests & Development Server

```bash
# Activate virtual environment
# Windows: .\.venv\Scripts\Activate.ps1 | Linux: source .venv/bin/activate

# Install development dependencies
pip install -r requirements-dev.txt

# Run full offline test suite (175 passed, 3 skipped; zero network calls)
python -m pytest -o addopts= -q

# Start development server with reload
uvicorn app.main:create_app --factory --reload --port 8000
```
