# BehindTheMark — API Contract (v1.1)

> v1.1: `pending_follow_ups` on join/me; submit budget is ≤30 s; rate limits split (public per IP, student per token).

Shared contract between backend (Track A) and frontend (Track B). Change it only by agreement; bump the version line when you do.

- Base path: `/api`. JSON in, JSON out. Times are ISO 8601 UTC.
- Errors: `{"detail": "human readable message"}`. Validation errors are `422` with FastAPI's `{"detail": [{"loc": [...], "msg": "..."}]}`.
- `429` → `{"detail": "Too many requests — wait a minute and try again."}`. Limits: create-class/sample/join 120/min per IP; submit/reply 20/min per student token.
- Teacher auth: header `X-Teacher-Token: <teacher_token>` (returned once, at class creation).
- Student auth: header `X-Student-Token: <student_token>` (returned once, at join).

## Enums

```
AnswerType     = "number" | "text" | "choice"
Confidence     = "sure" | "unsure" | "guessed"
Label          = "understood" | "misread" | "misconception" | "guessed" | "slip" | "not_sure"
HypothesisKind = "understood" | "misread" | "misconception" | "guessed" | "slip"
Source         = "rule" | "ai" | "both" | "teacher"
Status         = "open" | "settled" | "not_sure"     # open = waiting for follow-up reply
HypStatus      = "open" | "supported" | "ruled_out"
```

UI copy for labels (use these words; never show raw enum to users):
`understood` → "Understood" · `misread` → "Misread the question" · `misconception` → "Misconception: {misconception_label}" · `guessed` → "Likely guessed" · `slip` → "Careless slip" · `not_sure` → "Not sure yet".

---

## Health

### `GET /api/health`
`200` → `{"status": "ok", "db": "ok", "ai_configured": true}`

## Classes (teacher)

### `POST /api/classes`
Body `{"name": "7B Maths"}` (1–80 chars)
`201` →
```json
{"class_id": 1, "name": "7B Maths", "join_code": "K7PQ2M", "teacher_token": "Zx...secret"}
```
Frontend stores `teacher_token` in localStorage keyed by class id AND shows the teacher link `/{origin}/teacher/{class_id}#{teacher_token}` with a "save this link" warning.

### `POST /api/classes/sample`
No body. Creates a class pre-loaded with the **sample** fractions quiz (questions only, no responses). Same `201` shape as above. `is_sample` is true on `GET`.

### `GET /api/classes/{class_id}` · teacher
`200` →
```json
{
  "class_id": 1, "name": "7B Maths", "join_code": "K7PQ2M", "is_sample": false,
  "created_at": "2026-10-16T22:40:00Z",
  "quiz": null
}
```
`quiz` is `null` until set, otherwise a **Quiz** (below). `403` wrong token, `404` no class.

### `PUT /api/classes/{class_id}/quiz` · teacher
Replaces the whole quiz. Allowed only while the class has **no responses** (`409` otherwise).
Body:
```json
{
  "topic": "Fractions",
  "title": "Adding and comparing fractions",
  "questions": [
    {
      "prompt": "What is 1/2 + 1/4?",
      "correct_answer": "3/4",
      "answer_type": "number",
      "key_idea": "Use a common denominator: 1/2 = 2/4, so 2/4 + 1/4 = 3/4.",
      "choices": [],
      "misconceptions": [
        {"label": "Adds tops and bottoms", "trigger_answers": ["2/6"], "signal_text": "Adds numerators and denominators separately", "remedy_hint": "Show with fraction strips why quarters and halves can't be added directly"}
      ]
    }
  ]
}
```
Limits: 1–20 questions; prompt ≤1000; correct_answer ≤100; key_idea ≤1000; ≤6 choices; ≤6 misconceptions; ≤10 trigger answers each; signal/remedy ≤500. `choice` questions need ≥2 choices and `correct_answer` must be one of them.
`200` → **Quiz**:
```json
{
  "quiz_id": 1, "topic": "Fractions", "title": "Adding and comparing fractions",
  "questions": [
    {"question_id": 1, "position": 1, "prompt": "...", "correct_answer": "3/4", "answer_type": "number",
     "key_idea": "...", "choices": [],
     "misconceptions": [{"misconception_id": 1, "label": "...", "trigger_answers": ["2/6"], "signal_text": "...", "remedy_hint": "..."}]}
  ]
}
```

### `DELETE /api/classes/{class_id}` · teacher
`204`. Deletes class, quiz, students, responses, diagnoses.

## Students

### `POST /api/join`
Body `{"join_code": "k7pq2m", "nickname": "Asha"}` (code case-insensitive; nickname 1–30 chars)
`201` →
```json
{
  "student_id": 9, "student_token": "s3...secret", "nickname": "Asha", "class_name": "7B Maths",
  "quiz": {"topic": "Fractions", "title": "...", "questions": [
    {"question_id": 1, "position": 1, "prompt": "What is 1/2 + 1/4?", "answer_type": "number", "choices": []}
  ]},
  "answered_question_ids": [],
  "pending_follow_ups": []
}
```
Student quiz never includes correct answers, key ideas or misconceptions. `quiz` may be `null` (teacher hasn't set one → show "Your teacher hasn't added questions yet"). `404` unknown code.

### `GET /api/students/me` · student
`200` → same shape as join, without `student_token`.

`pending_follow_ups` lists follow-up questions still waiting for a reply, e.g.
`[{"follow_up_id": 4, "question_id": 1, "question_text": "Can you show how you'd add 1/3 + 1/6 the same way?"}]`.
**Frontend rule:** on load (and after any submit `409` or network error), call `me` and show pending follow-ups *before* the next unanswered question. A follow-up disappears from this list once answered, or once the teacher has reviewed that answer.

## Responses (student)

### `POST /api/responses` · student
Body:
```json
{"question_id": 1, "answer": "3/4", "explanation": "I turned 1/2 into 2/4 and added 1/4.", "self_confidence": "sure"}
```
answer 1–100 chars; explanation 0–2000 chars.
`201` →
```json
{"response_id": 31, "follow_up": null}
```
or, when the system wants to check its reading:
```json
{"response_id": 31, "follow_up": {"follow_up_id": 4, "question_text": "Can you show how you'd add 1/3 + 1/6 the same way?"}}
```
Usually 2–10 s, never more than ~30 s (server-side AI budget; after that it answers with rules / a template question) — show a loading state and use a 45 s client timeout. `409` already answered (call `me` to recover any pending follow-up); `404` question not in your class.
Student never receives correctness or labels.

### `POST /api/follow-ups/{follow_up_id}/reply` · student
Body `{"reply": "..."}` (1–1000 chars) → `200 {"status": "done"}`. `409` already replied. `404` not yours. Same ≤30 s budget as submit. If the teacher already reviewed the answer, the reply is still saved (teacher sees it) and the teacher's reading stays.

## Results (teacher)

### `GET /api/classes/{class_id}/results` · teacher
`200` →
```json
{
  "class_id": 1, "total_students": 12, "rule_only_count": 0,
  "questions": [
    {
      "question_id": 1, "position": 1, "prompt": "What is 1/2 + 1/4?", "correct_answer": "3/4",
      "total_responses": 10, "same_score_different_reasons": true,
      "groups": [
        {"is_correct": true, "count": 6, "labels": [
          {"label": "understood", "count": 4, "students": [
            {"student_id": 9, "nickname": "Asha", "response_id": 31, "label": "understood",
             "misconception_label": null, "certainty": 0.86, "status": "settled", "source": "both"}
          ]},
          {"label": "guessed", "count": 2, "students": []}
        ]},
        {"is_correct": false, "count": 4, "labels": []}
      ]
    }
  ]
}
```
Groups: correct first, then incorrect; empty groups omitted. `rule_only_count > 0` → show banner "Some answers were checked by rules only (AI unavailable)".

### `GET /api/responses/{response_id}` · teacher
`200` → **ResponseDetail**:
```json
{
  "response_id": 31, "student_id": 9, "nickname": "Asha",
  "question": { "...": "Quiz question object, as in PUT quiz response" },
  "answer": "3/4", "explanation": "...", "self_confidence": "sure", "is_correct": true,
  "created_at": "...",
  "diagnosis": {
    "diagnosis_id": 40, "version": 2, "label": "understood", "misconception_id": null,
    "misconception_label": null, "certainty": 0.86, "source": "both", "status": "settled", "note": "",
    "created_at": "...",
    "hypotheses": [
      {"kind": "understood", "misconception_id": null, "misconception_label": null,
       "evidence_for": "I turned 1/2 into 2/4", "evidence_against": "", "likelihood": 0.86, "status": "supported"}
    ]
  },
  "history": [{"version": 1, "label": "not_sure", "source": "both", "certainty": 0.55, "status": "open", "created_at": "..."}],
  "follow_up": {"question_text": "...", "student_reply": "...", "answered_at": "..."},
  "trace": [{"step": "rule_match", "source": "rule", "model": null, "prompt_version": null, "latency_ms": 1, "ok": true, "detail": "Correct answer"}]
}
```
`follow_up` may be `null`. `history` lists older versions (newest first), excluding the current one.

### `POST /api/responses/{response_id}/override` · teacher
Body `{"label": "misread", "misconception_id": null, "note": "Talked to her — she read 1/4 as 4."}`
`misconception_id` required when label is `misconception` (must belong to the question). note ≤500.
`200` → updated **ResponseDetail** (new version, `source: "teacher"`, old version moves to history). Teacher readings are final: later student replies never replace them.
