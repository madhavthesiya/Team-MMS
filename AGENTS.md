# Shared agent instructions

This is the common project guide for Codex, Claude Code, and other coding agents.
The repository is named BuildNight; the product is **BehindTheMark**.

## Start here

1. Read [README.md](README.md) and [docs/status.md](docs/status.md).
2. Run `git status --short` and inspect the files relevant to the task. Another person or agent may be editing this checkout.
3. For API or UI changes, read [docs/api-contract.md](docs/api-contract.md). For domain changes, read [docs/architecture.md](docs/architecture.md).
4. Read only the relevant implementation plan in `docs/superpowers/plans/`; the documentation map is in the README.

The status document is a dated snapshot, not a live task manager. Verify its claims against the current checkout.

## Sources of truth

- Current user instructions define the authorized task.
- This file defines shared engineering rules; [CONTRIBUTING.md](CONTRIBUTING.md) covers collaboration and handoffs.
- `docs/api-contract.md` defines the intended HTTP interface. Update the contract, backend schemas, tests, and affected client types together when changing it.
- `docs/architecture.md` explains the implementation; code and tests establish what actually exists.
- The design spec records product intent. Implementation plans describe work to do, not completed features or authorization to build everything.
- If code and documentation disagree, report the difference and resolve it within the task. Do not silently change an interface to match an old example.

## Product invariants

- Code decides answer correctness. AI never changes `Response.is_correct`.
- Preserve submitted evidence after initial validation/redaction. Reinterpretation creates a new diagnosis version, rather than rewriting the original response.
- AI labels are hypotheses for teachers, not student-facing verdicts. Student endpoints and screens must not expose answer keys, diagnoses, or teacher credentials.
- A teacher override must remain authoritative, including when it arrives during an AI request: an AI re-read is stored only if the follow-up's diagnosis is still the latest version at save time (row lock, re-check, `UNIQUE(response_id, version)`; see `docs/status.md`).
- Ask at most one follow-up per initial response. Recover pending follow-ups through `/api/students/me` before advancing a student to a new question; a saved reply whose processing didn't finish (`reply_saved: true`) is completed with `POST /api/follow-ups/{id}/resume`.
- Follow-ups are optional: `decline` records `skip`, `not_sure`, or `teacher` without AI inference or changing correctness. Predicted replies (`expected_evidence`) and the selection rationale are teacher-only planning metadata, never observed evidence. Keep checks short and non-repetitive; an unavailable useful check means teacher review, not another test.
- A confident diagnosis backed by a quote from the follow-up reply may resolve an answer-pattern disagreement. Preserve the ruled-out interpretation in history.
- For a wrong answer, choose a story only after alternatives were weighed (`MIN_STORIES_WEIGHED`, `STORY_MARGIN` in `pipeline.py`). "Ran out of time" rests only on recorded timing, never on model inference. Keep one hypothesis per story.
- Gemini failure must produce an honest, visibly rule-only fallback. Never substitute canned AI results.
- Sample quizzes are input data only. Mock model outputs belong in `backend/tests/`, never in application code or a future frontend.

## Implementation boundaries

- Backend: thin FastAPI routers in `backend/app/api/`, business logic in `services/`, persistence in `models.py`, request/response schemas in `schemas.py`.
- Gemini calls go through `backend/app/ai/client.py`; prompts are versioned in `ai/prompts.py`. Preserve guardrails and the shared AI request budget.
- Keep runtime configuration in `backend/app/config.py` and document new settings in `.env.example` without credentials.
- Local development uses SQLite by default; production Postgres behavior, especially concurrency, needs its own verification.
- `create_all()` never alters existing tables. Every schema change needs an additive, idempotent step in `backend/app/migrations.py` so deployed databases keep their data.
- The frontend (`frontend/`, Vite + React) now has teacher/student screens and the Riddle 3 optional-check controls. Preserve the existing design and typed API client; verify mobile layouts and loading/error/empty states rather than assuming a production build proves usability.
- Do not add infrastructure or dependencies just because a plan mentions them. Choose what the assigned change requires.

## Commands

Run from the repository root unless noted. Python 3.12 is the documented baseline.

```powershell
# Install once, on Windows, if the environment does not already exist.
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-dev.txt

# Offline tests, from backend/; no Gemini key required.
cd backend
.venv/Scripts/python.exe -m pytest -o addopts= -q

# Backend development server, from backend/.
.venv/Scripts/python.exe -m uvicorn app.main:create_app --factory --reload
```

For POSIX commands and opt-in live tests, see the README. The offline suite must not call a live model. A passing suite does not establish live Gemini access, deployment health, or concurrency safety.

For a documentation-only change, check links, paths, and commands; a backend test rerun is needed only when validating changed setup instructions or runtime claims. For code changes, run the relevant tests, then the offline backend suite. Add a regression test for a behavioral fix. Once a frontend exists, use its actual package scripts to build and test it; do not claim a nonexistent command passed.

## Working safely with other agents

- Keep changes within the assigned scope. Preserve unrelated edits and untracked files, including `tmp.txt` and `debug.log`.
- Re-read a shared file immediately before editing it. If another worker changed the same section, reconcile it rather than overwriting their work.
- Stage specific task files when a commit is requested. Do not use broad staging that sweeps in another worker's changes.
- Commit, push, deploy, and tag only within the user's authorization. Follow the existing Track C requirement for Shane's go-ahead before a shared-remote push; do not repeat a permission question for an action already authorized.
- Do not reset, rewrite history, discard another worker's changes, or delete local databases as a routine setup step.
- Keep credentials, tokens, `.env`, private student data, and local databases out of Git, logs, examples, and handoffs. See [SECURITY.md](SECURITY.md).
- Finish with what changed, validation performed, remaining gaps, and an actionable next step. Update `docs/status.md` when a capability or known issue changes, with evidence and a date.

## Code Review Rules

Prioritize authorization boundaries, evidence preservation, recoverable student flows, diagnosis-version consistency, teacher/AI write races, fallback honesty, and bounded request latency. Include a concrete trigger and file reference for each finding; do not treat planned work as a completed feature.
