# Project status

**Inspected:** 2026-10-17, Riddle 3 implementation originally on `7df970e`, integrated with `origin/main` at `a5a0cfc` on branch `codex/riddle-3-optional-checks` for review.

This is a point-in-time handoff. Recheck the current branch, filesystem, and tests before treating an item as current. Unchecked steps in an older implementation plan are not a reliable implementation inventory.

## Verified baseline

- Backend: FastAPI, SQLAlchemy, Pydantic settings, Gemini transport, and the synthetic sample quiz are present.
- API contract: version 1.4, including optional diagnostic checks and learner declines, with teacher-only rationale and predicted observations.
- Offline verification from `backend/`:

  ```powershell
  .venv/Scripts/python.exe -B -X utf8 -m pytest -o addopts= -q -p no:cacheprovider
  ```

  Integrated result: **156 passed, 3 skipped** (2026-10-17, after resolving the four conflicts with `a5a0cfc`; 12.54 s). Prior Riddle 3 result was 148 passed, 3 skipped. `RUN_LIVE_AI` was empty. The three skipped tests require opt-in live Gemini access.
- Frontend: the integrated `npm run build` passes (TypeScript + Vite); a >500 kB bundle warning remains. `npm run lint` exits successfully with 23 React hook/ref warnings; this is not a zero-warning baseline.
- Browser: isolated local FastAPI app, in-memory SQLite, scripted test model, and the real production React bundle. All three decline choices, pending-check refresh, completion, teacher explanations and no horizontal overflow checked at 360 px and 1280 px. Mobile teacher panes now scroll as one page; decorative cursor particles are restricted to the landing page. This is not a live-Gemini or hosted-deployment check.
- No live Gemini, hosted Postgres, deployment or classroom-load verification was performed during the Riddle 3 work or conflict integration.
- Upstream verification record preserved from `a5a0cfc`: the team reported **130 passed, 3 skipped**, live Gemini/Groq rotation and composite failover, and browser verification of the three teacher AI tools. Those checks predate this merge and are not evidence that `followup-v2` was live-verified.

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
| Riddle 3: one brief optional check, teacher rationale/predictions, learner choice | Implemented; offline/API and local browser checks pass | `services/followups.py`, `tests/test_riddle3_followups.py`, [handoff](superpowers/plans/2026-10-17-riddle-3.md); API v1.4 |
| Riddle 4: re-checks in changed situations, unaided, after a delay; better marks vs better understanding; changed next step when it didn't travel | Implemented; offline tests and local browser check pass (2026-10-17) | `services/transfer.py`, `tests/test_riddle4_transfer.py`, `tests/browser_riddle4.cjs`, [handoff](superpowers/plans/2026-10-17-riddle-4.md); API v1.5 |
| Public/student rate-limit split | Implemented; offline tests pass | `backend/app/rate_limit.py`, `test_basics.py` |
| Shared AI budget and per-call cap | Implemented; scripted timing tests pass | `backend/app/services/pipeline.py`, `ai/client.py`; real elapsed validation pending |
| React frontend and browser flows | Teacher/student screens exist; production build and targeted Riddle 3 browser checks pass. Not an exhaustive UI audit | `frontend/`; test-only browser harness below |
| Blocked-localStorage fallback | Implemented in `frontend/src/lib/storage.ts`; blocked-storage behavior not browser-tested in this pass | Verify separately |
| Labelled evaluation cases/runner/reports | Runner and 51 cases exist; upstream reports a confusion matrix; not rerun in this integration | `eval/cases.jsonl`, `eval/run_eval.py`, `eval/results/` |
| Live Gemini schema/integration checks | Tests exist; upstream reports provider-pool/failover checks; Riddle 3 live quality remains unverified | `backend/tests/test_gemini_live.py`, `backend/app/ai/client.py` |
| CI, Docker, hosting blueprint, smoke scripts | Upstream reports CI green (28s), Docker and smoke checks; not rerun in this integration | `.github/workflows/tests.yml`, `Dockerfile`, `render.yaml`, `scripts/smoke.*` |

## Fixed after the review of `00fef16` (2026-10-17)

| Finding | Fix | Regression test |
| --- | --- | --- |
| Existing databases miss new columns / version constraint | `app/migrations.py` runs after `create_all()`: idempotent `ADD COLUMN` with safe defaults and `CREATE UNIQUE INDEX` on `diagnoses(response_id, version)`; no data dropped | `test_review_fixes.py` (old-schema SQLite file upgraded, data kept, duplicates rejected, idempotent) |
| Failed diagnosis save strands a committed reply | Store only if the follow-up's version is still the latest; otherwise skip. A saved-but-unprocessed reply stays in `pending_follow_ups` (`reply_saved: true`); `POST /api/follow-ups/{id}/resume` finishes it, idempotently | `test_failed_save_leaves_the_follow_up_resumable`, `test_resume_is_safe_to_repeat_and_needs_a_reply_first` |
| Same story both possible and ruled out | Hypotheses reconciled by kind + misconception; recorded timing can't be ruled out by the model | `test_recorded_timing_story_is_not_also_listed_as_ruled_out`, `test_rule_story_ruled_out_by_the_ai_keeps_the_ai_reason_as_evidence_against` |
| Eval template omitted `out_of_time` | Track C `LABELS` and label list updated | `test_eval_template_lists_every_label` |

Upgrade path verified on SQLite only; run it once against the hosted Postgres before the freeze.

## Known issues

### Riddle 3 verification boundaries

- `followup-v2` candidate quality and non-leading language have not been assessed against live Gemini. Word count and pattern filters are heuristics, not measured information gain or semantic guarantees.
- New schema defaults, learner choices and write interleavings were checked on SQLite only; hosted Postgres still needs verification.
- Earlier review findings remain outside this Riddle 3 change: eval `--rule-only` still selects the configured AI client when a key exists; resume lacks a processing lease and can race an in-flight reread; a failed version-index upgrade is logged rather than preventing startup. Resolve these before relying on live evaluation or concurrent production use.
- README deployment/video/pack links have not been verified in this pass. Do not treat them as confirmed artifacts.

### Reproduce the targeted browser check

1. Build `frontend/` with `npm ci` then `npm run build`.
2. From `backend/`, run `.venv/Scripts/python.exe -B -X utf8 -m uvicorn tests.browser_riddle3_app:app --host 127.0.0.1 --port 8017 --no-access-log`.
3. From the root, run `node backend/tests/browser_riddle3.cjs <path-to-playwright-module>`. Set `BTM_BROWSER_PATH` when using an existing Chromium executable; optionally set `BTM_SCREENSHOT_DIR` to an existing temporary output folder.
4. Stop the test server afterward. It uses only an in-memory DB and a scripted model inside `backend/tests/`; never deploy that module. No production `.env`, local classroom DB or real student data is used.

### OPEN-01: teacher override can lose to an in-flight AI reread — fixed 2026-10-17 (SQLite verified)

Fix: `reply_to_follow_up` claims the follow-up with a conditional UPDATE (a second simultaneous reply gets 409), commits the reply before the model call, then locks the response row (`SELECT … FOR UPDATE`), re-checks the latest version and skips storing if a teacher reading exists. Versions come from `MAX(version)+1` with `UNIQUE(response_id, version)` as a backstop; overrides retry on conflict. Tests: override during a paused AI call, second reply mid-call, duplicate version rejected. Still to do: run the same scenarios against hosted Postgres.

Original report:

**Priority:** fix before relying on teacher-final behavior with concurrent users.

The current `reply_to_follow_up` checks the current diagnosis before calling AI. If a teacher override arrives after that check but before the AI result is stored, the new AI version can replace the teacher's reading. Version allocation also uses collection length without a database version uniqueness constraint.

This interleaving was reproduced during the preceding review with a synthetic AI client and an in-memory database: original version 1 -> teacher version 2 during the model call -> AI version 3 selected as current. The inspected source still has the same pre-call check and unconditional outcome storage. The passing sequential test does not cover this case.

**Acceptance:** serialize or otherwise atomically guard per-response diagnosis updates, refresh current teacher state at persistence time, keep the late reply as evidence, and ensure AI cannot supersede the teacher. Test an override during a paused AI call, simultaneous replies, and diagnosis-version uniqueness. Validate the chosen transaction behavior on Postgres as well as local SQLite.

### OPEN-02: release and data-handling checks remain unverified

Upstream reports provider-pool, CI, Docker and smoke verification as recorded above; those results have not been independently rechecked in this integration. Riddle 3 live-model quality and hosted database concurrency remain unverified. The local browser check covers the Riddle 3 flow with a scripted model. Regex PII redaction also does not cover every prompt field; see [security boundaries](../SECURITY.md). These are explicit gaps, not evidence that the prototype has been audited or is ready for real student data.

## Immediate handoff

1. Verify OPEN-01 behaviour and the schema upgrade on hosted Postgres (SQLite tests pass).
2. Review the local Riddle 3 diff and exercise the remaining frontend flows (timed auto-submit, real failed-reply recovery, blocked storage, teacher override) against API v1.4.
3. Run the eval and the live Gemini tests with a real key; record the results.
4. Deploy, run the smoke script against the live URL, and record it here.

When changing this file, replace stale observations with dated evidence. Do not mark a proposal complete because a plan, scaffold, or test double exists.
