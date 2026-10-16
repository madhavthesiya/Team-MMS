# BehindTheMark — Design Spec

**Event:** Build Night (9:00 AM freeze) · **Theme:** Learning — Riddle 1 "The Same Number"
**Team:** 2–3 people · **Budget:** ~10 hours · **Stack:** FastAPI + React (Vite, TS) + Gemini · **Date:** 2026-10-16

## 1. Problem and users

Two learners get the same mark. One understood and slipped on the format; the other pattern-matched or guessed. The number puts them together, so both get the same next assignment — and both are let down.

- **Teachers** (school / early college, one class at a time) need to see *why* a student got an answer right or wrong, not just *whether*.
- **Students** need their reasoning heard, and a next step that fits what they actually misunderstand.

**Product:** Teacher sets a short quiz with a key idea and known misconceptions per question. Students answer, explain, and rate their confidence. The system separates evidence (what the student did) from interpretation (what it might mean), proposes competing explanations with evidence, asks one targeted follow-up when unsure, and shows the teacher same-score students split by likely reason.

**Core rule:** AI diagnosis is a hypothesis, never a verdict. Evidence is immutable; diagnosis is versioned and revisable.

## 2. Architecture and hosting

```
backend/   FastAPI app
  app/api/        routers (classes, quizzes, responses, diagnoses, health)
  app/services/   normalizer, rule_matcher, pipeline, followup
  app/ai/         gemini_client, prompts (versioned), schemas
  app/models/     SQLAlchemy models
  app/config.py   pydantic-settings
  app/sample/     fractions_quiz.json  (SAMPLE INPUT — questions only)
  tests/
frontend/  React + Vite + TypeScript + Tailwind
eval/      cases.jsonl, run_eval.py, results/
.env.example, README.md
```

- **One deployed service:** FastAPI serves the built React bundle. One URL, no CORS.
- **Hosting:** Render web service (free) + UptimeRobot ping on `/health` every 5 min to avoid cold starts; upgrade to Starter ($7) if budget allows. Fallback: Hugging Face Spaces (Docker).
- **Database:** Neon Postgres (free) in production; SQLite when `DATABASE_URL` is unset, so a clean clone runs with only `GEMINI_API_KEY`.
- **Config:** `pydantic-settings` — `GEMINI_API_KEY`, `GEMINI_MODEL`, `DATABASE_URL`, `CERTAINTY_THRESHOLD` (0.7), `AI_TIMEOUT_SECONDS` (20, one call), `AI_BUDGET_SECONDS` (30, all calls in a request), `RATE_LIMIT_PUBLIC` (120/min per IP), `RATE_LIMIT_STUDENT` (20/min per student token). No settings buried in code.
- **Access (no login):** "Create class" returns a secret teacher link (random token, stored hashed) and a 6-char student join code. Students join with code + nickname. "Try sample class" creates a class from the sample quiz through the normal service layer.

## 3. Data model

```
Class          id, name, join_code, teacher_token_hash, is_sample, created_at
Quiz           id, class_id, topic, title
Question       id, quiz_id, position, prompt, correct_answer, answer_type(number|text|choice), key_idea
Misconception  id, question_id, label, trigger_answers[], signal_text, remedy_hint
Student        id, class_id, nickname, created_at
Response       id, student_id, question_id, answer_raw, explanation_raw,
               self_confidence(sure|unsure|guessed), is_correct, created_at        -- immutable
Diagnosis      id, response_id, version, label, certainty, source(rule|ai|both|teacher),
               status(open|settled|not_sure), note, created_at  -- versioned; current = highest version
Hypothesis     id, diagnosis_id, kind(understood|misread|misconception|guessed|slip),
               misconception_id?, evidence_for, evidence_against, likelihood, status(open|supported|ruled_out)
FollowUp       id, diagnosis_id, question_text, discriminates[], student_reply, answered_at
AIRun          id, diagnosis_id, step, source, model, prompt_version, latency_ms, ok, detail
```

- Misconceptions are entered by the teacher in the UI and stored in the DB — never in code.
- Teacher override writes a new Diagnosis version with `source=teacher`; nothing is deleted.
- **Teacher readings are final.** A student reply that arrives after an override is saved as evidence (visible to the teacher) but never creates a newer AI version; the follow-up stops being pending once the teacher has reviewed.
- `AIRun` stores parsed outcomes and metadata, not raw prompts (privacy).

## 4. AI pipeline

Per submitted response:

1. **Normalize (code).** `3/4`, `0.75`, `75%`, `¾` → same `Fraction`; text casefolded and punctuation-stripped; choice by letter. `is_correct` is always decided in code. AI never changes a score.
2. **Rule match (code).** Wrong answer checked against `Misconception.trigger_answers`; self-confidence `guessed` seeds a `guessed` hypothesis. Produces a standalone rule-based diagnosis.
3. **AI analysis (Gemini, JSON mode with response schema).** Input: question, key idea, teacher misconceptions, answer, explanation, self-confidence. Student text is wrapped in delimiters and treated as data. Output: hypotheses `{kind, misconception_id, evidence_quote, evidence_against, likelihood}` + label + certainty.
4. **Guardrails (code).**
   - Output must parse into Pydantic models; on failure retry once, then fall back to rule-only.
   - `evidence_quote` must appear verbatim (whitespace/case-normalized) in student text; otherwise the hypothesis is dropped.
   - `misconception_id` must belong to the question; `label`/`kind` are enums.
   - `guessed` requires evidence (self-report, or explanation contradicts answer); otherwise `not_sure`.
   - `certainty < CERTAINTY_THRESHOLD` or rule/AI disagreement → `not_sure` → step 5.
   - **Follow-up evidence beats the answer-pattern rule.** Rules only see the answer string. On the second pass, a confident AI label whose quoted evidence comes *from the follow-up reply* settles the case even if the rule disagrees (`source=ai`); the rule's reading is kept as a `ruled_out` hypothesis. Evidence only from the first explanation does not overrule the rule.
5. **Targeted follow-up.** Gemini proposes a short question and up to two alternatives to distinguish the top hypotheses. Code selects a brief, safe candidate or a hypothesis-specific fallback; if none is useful and safe, defer to the teacher. The reply re-runs step 3 → new Diagnosis version. Max one optional follow-up; still unclear → `not_sure`. Learners can decline without AI inference. Pending checks are recovered through `GET /api/students/me`. See the Riddle 3 delta below and API v1.4.

**Time budget:** all model calls in one request share `AI_BUDGET_SECONDS` (30 s); each call's timeout is capped at what is left, a call is skipped with < 2 s left (rules / template question instead). The frontend waits 45 s.

**Failure handling:** Gemini error / 429 / timeout → rule-based diagnosis, visibly labelled "AI unavailable — rule-based only". Never a fake AI result, never a crash.

**Privacy and abuse:** regex redaction of emails and phone numbers before any Gemini call; rate limits split so a class on one Wi-Fi IP isn't blocked: anonymous endpoints per IP (120/min), answers and replies per student token (20/min); consent notice on the student screen before first submission; teacher can delete a class and all its data.

**Prompt injection:** enum labels, verbatim-quote check and rule/AI disagreement check limit what injected text can achieve; injection cases are in the eval set.

## 5. Frontend

Mobile-first (Tailwind). Every data view has loading, error (with retry) and empty states.

- **Landing:** one-line pitch ("Same score. Different story."), buttons: Create class · Join as student · Try sample class. Short how-to guide.
- **Teacher — setup:** create class → teacher link + join code with copy buttons and a "save this link" warning. Quiz builder: questions (prompt, correct answer, type, key idea) and per-question misconceptions (label, trigger answers, signal, remedy hint).
- **Teacher — results:** per question, students grouped by correct/incorrect, then split by diagnosis label ("Same score, different reasons"). Response detail: answer, explanation, confidence, hypotheses with evidence and certainty, follow-up exchange, "Why this label?" trace from `AIRun`, override control. Banner when any diagnosis is rule-only.
- **Student:** join code + nickname → one question per screen: answer, explanation, confidence (sure / unsure / guessed) → "Reading your reasoning…" → follow-up if asked → done screen with supportive, label-free summary. Students never see diagnosis labels.
- **Empty states:** "No responses yet — share code ABC123", "No misconceptions added — the AI will still analyse explanations".

## 6. Testing and evaluation

- **pytest (no API key needed):** normalizer, rule matcher, guardrails (quote verification, enum enforcement, leak check, disagreement → `not_sure`, guessed-needs-evidence), pipeline fallback on AI failure, API validation (422 on bad input), teacher-token auth. Gemini replaced by a clearly named `FakeGeminiClient` in `tests/` only.
- **Eval set:** `eval/cases.jsonl`, ~40 hand-labelled cases across the sample questions — understood, misread, misconception, guessed, slip — plus adversarial (prompt injection, empty explanation, gibberish, Hinglish, very long text). `eval/run_eval.py` runs the real pipeline against Gemini and writes accuracy, `not_sure` rate, confident-wrong rate and a confusion matrix to `eval/results/`. Goal: low confident-wrong rate; `not_sure` is acceptable.
- **Live smoke:** script hits the deployed URL (health, create sample class, submit one response).

## 7. Risks and honest limits (README seed)

- Who can be harmed: a student mislabelled as "guessed" or a misconception they don't hold. Mitigations: teacher-only labels, evidence + certainty shown, `not_sure` state, override with history.
- Gemini can be wrong or unavailable; rule-only fallback is weaker and says so.
- Explanations in other languages or very short explanations reduce accuracy.
- Not a grading tool; it never changes a mark.
- Sample quiz is sample input only; no responses or results are pre-filled.

## 8. Submission checklist mapping

- README: problem and users, riddle-by-riddle changes, risks and limits, setup, Debate response, Frontend Pack link.
- Live URL with "Try sample class" (no login).
- Demo video ≤ 2 min.
- Frontend Pack: 8–12 real screenshots (landing, quiz builder, student question, loading, follow-up, results split, response detail, error, empty, phone view), one-line caption each.
- Final git tag at freeze.

## 9. Team split (2–3 people)

- **A — Backend + AI:** models, API, pipeline, guardrails, pytest.
- **B — Frontend:** pages, states, mobile layout.
- **C — Eval + ops:** eval set and runner, deploy (Render/Neon/UptimeRobot) in hour 1, README, Frontend Pack, video. (If two people, A takes deploy, B takes README/Pack.)

**Order:** scaffold + deploy hello-world first (hour 1) → core R1 flow end to end → eval → adapt to new riddles as they are revealed → README/Pack/video → tag before 9:00.

## 10. Riddle 2 — One Error, Several Stories (revealed 2026-10-17)

> Three learners choose the same wrong answer: one followed a mistaken rule, one missed a condition in the question, one ran out of time. Whoever looks usually picks the first story that comes to mind. What would it take to treat a mistake as a clue instead of a verdict, and what would you need to see before choosing a story?

How the build responds:

- **Three stories, named as in the riddle.** `misconception` → "Mistaken rule", `misread` → "Missed a condition in the question", new `out_of_time` → "Ran out of time" (plus `slip`, `guessed`).
- **"Ran out of time" rests on recorded facts, not AI inference.** Optional per-question `time_limit_seconds`; the student screen counts down and auto-submits with `timed_out`; students can tick "I ran out of time"; `time_spent_seconds` is stored. Code adds the timing story; the AI may only choose it when those facts exist (guardrail).
- **A clue, not a verdict.** For a wrong answer the AI must weigh every story and return the rejected ones with a reason (`alternatives_ruled_out`). Code chooses a story only if at least 3 stories were weighed and the chosen one leads the next by ≥ 0.2 likelihood (`MIN_STORIES_WEIGHED`, `STORY_MARGIN` in `pipeline.py`); otherwise the stories stay open and one follow-up separates them. Without the AI, two competing code stories (e.g. trigger answer + timer) are never decided by rules alone.
- **What you'd need to see.** Every hypothesis carries `would_confirm` (from the AI, or fixed text for code stories, e.g. "give the same question again with no time limit").
- **Teacher view.** Results group wrong answers by value — "3 students answered 1/5: mistaken rule ×1 · missed a condition ×1 · ran out of time ×1" (`wrong_answers`, `several_stories`). Response detail lists every story considered: chosen, still possible, ruled out (with reason), each with what would confirm it.
- **Data model additions:** `Question.time_limit_seconds`; `Response.time_spent_seconds`, `timed_out`, `reported_out_of_time`; `Hypothesis.would_confirm`; `UNIQUE(response_id, version)` on `Diagnosis`. Existing databases are upgraded in place at startup by `app/migrations.py` (idempotent ADD COLUMN with safe defaults + the unique index); no data is dropped.
- **Prompt:** `analysis-v2` adds timing facts, the story list and `would_confirm`.
- **Concurrency (review item OPEN-01, fixed alongside):** replies are claimed atomically, committed before the model call, and the AI result is stored only if nothing newer than the follow-up's own version appeared meanwhile (row lock + re-check + unique version). If processing never finishes (timeout, crash, failed save), the follow-up stays in `pending_follow_ups` with `reply_saved: true` and `POST /api/follow-ups/{id}/resume` completes it.
- **One entry per story:** hypotheses are reconciled by kind + misconception before saving; recorded timing can't be "ruled out" by the model, and an AI rejection of a code story is kept as that story's evidence-against.

## 11. Riddle 3 — The Question That Separates (revealed 2026-10-17)

One more interaction should distinguish possible explanations without repeating confusion or exhausting the learner. The purpose is understanding, not another score; people must retain control.

- Keep the existing diagnostic quiz; do not introduce an unverified learning-path or practice engine.
- Propose at most three small checks in the existing model call. Each has teacher-only rationale and predicted observations keyed to competing stories.
- Select the shortest eligible check after deterministic length, repetition, judgement and direct-answer-leak checks. These are heuristics, not a proof of information gain or semantic safety.
- Offer one optional, untimed check. Student choices: answer, not sure, skip, discuss with teacher. A choice to stop is not evidence of guessing or misunderstanding.
- Store original evidence unchanged. Declines close the pending check, retain competing stories and leave `not_sure` unless a teacher already decided. Teacher overrides remain authoritative.
- Show why the check was chosen, predictions versus actual reply/choice, and teacher controls. No useful safe check means teacher review, not a generic repeat question.
- See [the Riddle 3 handoff](../plans/2026-10-17-riddle-3.md) for implementation and verification boundaries.
