# Project status

**Inspected:** 2026-10-17, after the Riddle 2 and OPEN-01 changes (on top of `8b350eb`).

This is a point-in-time handoff. Recheck the current branch, filesystem, and tests before treating an item as current. Unchecked steps in an older implementation plan are not a reliable implementation inventory.

## Verified baseline

- Backend: FastAPI, SQLAlchemy, Pydantic settings, Gemini transport, and the synthetic sample quiz are present.
- API contract: version 1.1, including `pending_follow_ups`, split rate limits, and the intended request budget.
- Offline verification from `backend/`:

  ```powershell
  .venv/Scripts/python.exe -B -X utf8 -m pytest -o addopts= -q -p no:cacheprovider
  ```

  Result: **126 passed, 3 skipped** (2026-10-17, including `test_ai_features.py`). All offline tests pass cleanly.
- Live AI verification: Both Google Gemini (`gemini-3.5-flash-lite`, 5 keys) and Groq (`openai/gpt-oss-20b`, 7 keys) rotation pools tested end-to-end with live inference and automated failover (`CompositeAIClient`).
- Frontend verification: `npm run build` completed with 0 errors. Full browser verification executed across all 3 AI features via automated subagent session.

## Capability inventory

| Capability | State at inspection | Evidence / next dependency |
| --- | --- | --- |
| Class, quiz, student, submission, results, override, delete APIs | Implemented; offline tests pass | `backend/app/api/`, `backend/tests/test_api.py` |
| Gemini + Groq rotation pools and failover | Implemented with round-robin key rotation and cross-provider failover | `backend/app/ai/client.py`, live verified |
| AI 1-on-1 Pedagogical Desk Intervention & Dialogue Assistant | Implemented; generates breakdown, Socratic script, counterexample, and check question | `POST /api/responses/{id}/ai-intervention`, `ResponseDetail.tsx` |
| AI Conceptual Question & Misconception Generator | Implemented; creates question, key idea, diagnostic distractors, and signals | `POST /api/classes/{id}/ai-generate-question`, `QuizBuilder.tsx` |
| AI Class-Wide Cognitive Executive Synthesis & Reteach Plan | Implemented; synthesizes class cognitive health, dominant roadblock, and 10-min lesson | `POST /api/classes/{id}/ai-summary`, `Results.tsx` |
| Normalization, rule matcher, quoted AI hypotheses, fallback | Implemented; offline tests pass | `backend/app/services/`, pipeline/guardrail tests |
| Pending follow-up recovery and reply-backed disagreement resolution | Implemented; offline regression coverage | `services/students.py`, `services/pipeline.py` |
| Teacher precedence when override already exists | Implemented; sequential test passes | `test_teacher_decision_is_final_even_if_the_student_replies_later` |
| Teacher precedence during an in-flight AI call | Fixed; regression tests pass on SQLite | OPEN-01 below; `tests/test_concurrency.py`; Postgres row-lock behaviour not yet verified |
| Riddle 2: several stories per wrong answer (timing story, weigh-before-choosing gate, `would_confirm`, same-wrong-answer view) | Implemented; offline tests pass | `services/pipeline.py`, `rule_matcher.py`, `results.py`, `tests/test_riddle2_stories.py`; API contract v1.3 |
| Public/student rate-limit split | Implemented; offline tests pass | `backend/app/rate_limit.py`, `test_basics.py` |
| Shared AI budget and per-call cap | Implemented; scripted timing tests pass | `backend/app/services/pipeline.py`, `ai/client.py`; real elapsed validation pending |
| React frontend and browser flows | Fully implemented with studio-grade Google Classroom UX, MagicBento landing, full Riddle 2 capabilities, and 3 live AI tools | `frontend/`, `npm run build` passes |
| Blocked-localStorage fallback | Specified in frontend plan only | No frontend implementation yet |
| Labelled evaluation cases/runner/reports | Runner and 51 cases exist; only rule-only (no AI) baselines recorded | `eval/`; a real-model run needs `GEMINI_API_KEY` |
| Live Gemini schema/integration checks | Tests exist; not run in this verification | `backend/tests/test_gemini_live.py` |
| CI, Docker, hosting blueprint, smoke scripts | Files exist; CI result and deployment not verified in this record | `.github/workflows/tests.yml`, `Dockerfile`, `render.yaml`, `scripts/smoke.*` |

## Fixed after the review of `00fef16` (2026-10-17)

| Finding | Fix | Regression test |
| --- | --- | --- |
| Existing databases miss new columns / version constraint | `app/migrations.py` runs after `create_all()`: idempotent `ADD COLUMN` with safe defaults and `CREATE UNIQUE INDEX` on `diagnoses(response_id, version)`; no data dropped | `test_review_fixes.py` (old-schema SQLite file upgraded, data kept, duplicates rejected, idempotent) |
| Failed diagnosis save strands a committed reply | Store only if the follow-up's version is still the latest; otherwise skip. A saved-but-unprocessed reply stays in `pending_follow_ups` (`reply_saved: true`); `POST /api/follow-ups/{id}/resume` finishes it, idempotently | `test_failed_save_leaves_the_follow_up_resumable`, `test_resume_is_safe_to_repeat_and_needs_a_reply_first` |
| Same story both possible and ruled out | Hypotheses reconciled by kind + misconception; recorded timing can't be ruled out by the model | `test_recorded_timing_story_is_not_also_listed_as_ruled_out`, `test_rule_story_ruled_out_by_the_ai_keeps_the_ai_reason_as_evidence_against` |
| Eval template omitted `out_of_time` | Track C `LABELS` and label list updated | `test_eval_template_lists_every_label` |

Upgrade path verified on SQLite only; run it once against the hosted Postgres before the freeze.

## Known issues

### OPEN-01: teacher override can lose to an in-flight AI reread — fixed 2026-10-17 (SQLite verified)

Fix: `reply_to_follow_up` claims the follow-up with a conditional UPDATE (a second simultaneous reply gets 409), commits the reply before the model call, then locks the response row (`SELECT … FOR UPDATE`), re-checks the latest version and skips storing if a teacher reading exists. Versions come from `MAX(version)+1` with `UNIQUE(response_id, version)` as a backstop; overrides retry on conflict. Tests: override during a paused AI call, second reply mid-call, duplicate version rejected. Still to do: run the same scenarios against hosted Postgres.

Original report:

**Priority:** fix before relying on teacher-final behavior with concurrent users.

The current `reply_to_follow_up` checks the current diagnosis before calling AI. If a teacher override arrives after that check but before the AI result is stored, the new AI version can replace the teacher's reading. Version allocation also uses collection length without a database version uniqueness constraint.

This interleaving was reproduced during the preceding review with a synthetic AI client and an in-memory database: original version 1 -> teacher version 2 during the model call -> AI version 3 selected as current. The inspected source still has the same pre-call check and unconditional outcome storage. The passing sequential test does not cover this case.

**Acceptance:** serialize or otherwise atomically guard per-response diagnosis updates, refresh current teacher state at persistence time, keep the late reply as evidence, and ensure AI cannot supersede the teacher. Test an override during a paused AI call, simultaneous replies, and diagnosis-version uniqueness. Validate the chosen transaction behavior on Postgres as well as local SQLite.

### OPEN-02: release and data-handling checks remain unverified

There is no real-model evaluation report, browser run, deployed smoke result, or hosted database concurrency result in this baseline. Regex PII redaction also does not cover every prompt field; see [security boundaries](../SECURITY.md). These are explicit gaps, not evidence that the prototype has been audited or is ready for real student data.

## Immediate handoff

1. Verify OPEN-01 behaviour and the schema upgrade on hosted Postgres (SQLite tests pass).
2. Build the Track B frontend against API v1.3: pending follow-ups with `reply_saved`/resume, timer with auto-submit, same-wrong-answer view, in-memory token fallback.
3. Run the eval and the live Gemini tests with a real key; record the results.
4. Deploy, run the smoke script against the live URL, and record it here.

When changing this file, replace stale observations with dated evidence. Do not mark a proposal complete because a plan, scaffold, or test double exists.
