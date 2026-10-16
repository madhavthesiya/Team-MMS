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
- **Config:** `pydantic-settings` — `GEMINI_API_KEY`, `GEMINI_MODEL`, `DATABASE_URL`, `CERTAINTY_THRESHOLD` (0.7), `AI_TIMEOUT_SECONDS` (15), `RATE_LIMIT`. No settings buried in code.
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
               status(open|settled|not_sure), superseded_by, created_at             -- versioned
Hypothesis     id, diagnosis_id, kind(understood|misread|misconception|guessed|slip),
               misconception_id?, evidence_for, evidence_against, likelihood, status(open|supported|ruled_out)
FollowUp       id, diagnosis_id, question_text, discriminates[], student_reply, answered_at
AIRun          id, diagnosis_id, step, source, model, prompt_version, latency_ms, ok, error_kind
```

- Misconceptions are entered by the teacher in the UI and stored in the DB — never in code.
- Teacher override writes a new Diagnosis version with `source=teacher`; nothing is deleted.
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
5. **Targeted follow-up.** Gemini proposes one question that discriminates between the top two hypotheses. Code rejects any follow-up containing the correct answer and falls back to a template ("Walk me through how you got {answer}"). The reply re-runs step 3 → new Diagnosis version. Max one follow-up; still unclear → `not_sure` for the teacher.

**Failure handling:** Gemini error / 429 / timeout → rule-based diagnosis, visibly labelled "AI unavailable — rule-based only". Never a fake AI result, never a crash.

**Privacy and abuse:** regex redaction of emails and phone numbers before any Gemini call; per-IP rate limiting (slowapi); consent notice on the student screen before first submission; teacher can delete a class and all its data.

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
