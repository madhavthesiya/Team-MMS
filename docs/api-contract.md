# BehindTheMark — API Contract (v1.3)

> v1.3: `pending_follow_ups[].reply_saved`; new `POST /api/follow-ups/{id}/resume` to finish a saved reply whose processing didn't complete.
>
> v1.2 (Riddle 2 — One Error, Several Stories): new label `out_of_time`; optional per-question `time_limit_seconds`; submit takes `time_spent_seconds`, `timed_out`, `ran_out_of_time`; hypotheses carry `would_confirm` and rejected stories (`status: ruled_out`); results add `wrong_answers` (same wrong answer → its different stories); UI copy for `misread` is now "Missed a condition in the question".
>
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
Label          = "understood" | "misread" | "misconception" | "guessed" | "slip" | "out_of_time" | "not_sure"
HypothesisKind = "understood" | "misread" | "misconception" | "guessed" | "slip" | "out_of_time"
Source         = "rule" | "ai" | "both" | "teacher"
Status         = "open" | "settled" | "not_sure"     # open = waiting for follow-up reply
HypStatus      = "open" | "supported" | "ruled_out"
```

UI copy for labels (use these words; never show raw enum to users):
`understood` → "Understood" · `misread` → "Missed a condition in the question" · `misconception` → "Mistaken rule: {misconception_label}" · `guessed` → "Likely guessed" · `slip` → "Careless slip" · `out_of_time` → "Ran out of time" · `not_sure` → "Several stories — not chosen yet".

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
      "time_limit_seconds": 60,
      "misconceptions": [
        {"label": "Adds tops and bottoms", "trigger_answers": ["2/6"], "signal_text": "Adds numerators and denominators separately", "remedy_hint": "Show with fraction strips why quarters and halves can't be added directly"}
      ]
    }
  ]
}
```
`time_limit_seconds` is optional (10–3600, or `null` for no timer). Limits: 1–20 questions; prompt ≤1000; correct_answer ≤100; key_idea ≤1000; ≤6 choices; ≤6 misconceptions; ≤10 trigger answers each; signal/remedy ≤500. `choice` questions need ≥2 choices and `correct_answer` must be one of them.
`200` → **Quiz**:
```json
{
  "quiz_id": 1, "topic": "Fractions", "title": "Adding and comparing fractions",
  "questions": [
    {"question_id": 1, "position": 1, "prompt": "...", "correct_answer": "3/4", "answer_type": "number",
     "key_idea": "...", "choices": [], "time_limit_seconds": 60,
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
    {"question_id": 1, "position": 1, "prompt": "What is 1/2 + 1/4?", "answer_type": "number", "choices": [], "time_limit_seconds": 60}
  ]},
  "answered_question_ids": [],
  "pending_follow_ups": []
}
```
Student quiz never includes correct answers, key ideas or misconceptions. `quiz` may be `null` (teacher hasn't set one → show "Your teacher hasn't added questions yet"). `404` unknown code.

### `GET /api/students/me` · student
`200` → same shape as join, without `student_token`.

`pending_follow_ups` lists follow-up questions still waiting for a reply, e.g.
`[{"follow_up_id": 4, "question_id": 1, "question_text": "Can you show how you'd add 1/3 + 1/6 the same way?", "reply_saved": false}]`.
`reply_saved: true` means the reply was saved but processing didn't finish (timeout, crash, failed save): call `POST /api/follow-ups/{id}/resume` instead of asking again.
**Frontend rule:** on load (and after any submit `409` or network error), call `me` and show pending follow-ups *before* the next unanswered question. A follow-up disappears from this list once answered, or once the teacher has reviewed that answer.

## Responses (student)

### `POST /api/responses` · student
Body:
```json
{"question_id": 1, "answer": "3/4", "explanation": "I turned 1/2 into 2/4 and added 1/4.", "self_confidence": "sure",
 "time_spent_seconds": 34, "timed_out": false, "ran_out_of_time": false}
```
answer 1–100 chars; explanation 0–2000 chars. Timing fields are optional: `time_spent_seconds` (0–7200) = seconds from showing the question to submitting; `timed_out` = the question's timer hit zero and the app auto-submitted whatever was typed (ignored when the question has no timer); `ran_out_of_time` = the student ticked "I ran out of time". The "Ran out of time" story is only ever based on these two flags, never guessed by the AI.
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
Body `{"reply": "..."}` (1–1000 chars) → `200 {"status": "done"}`. `409` already replied. `404` not yours. Same ≤30 s budget as submit. If the teacher already reviewed the answer, the reply is still saved (teacher sees it) and the teacher's reading stays. A `409` whose message says the answer is saved means processing failed after saving: the follow-up shows up in `me` with `reply_saved: true`; call resume.

### `POST /api/follow-ups/{follow_up_id}/resume` · student
No body. Finishes processing a saved reply → `200 {"status": "done"}`. Safe to repeat: if it was already processed or the teacher has decided, it does nothing and still returns `200`. `409` if no reply has been saved yet; `404` not yours. Same ≤30 s budget as submit.

## Results (teacher)

### `GET /api/classes/{class_id}/results` · teacher
`200` →
```json
{
  "class_id": 1, "total_students": 12, "rule_only_count": 0,
  "questions": [
    {
      "question_id": 1, "position": 1, "prompt": "What is 1/2 + 1/4?", "correct_answer": "3/4",
      "total_responses": 10, "same_score_different_reasons": true, "same_wrong_answer_different_stories": true,
      "groups": [
        {"is_correct": true, "count": 6, "labels": [
          {"label": "understood", "count": 4, "students": [
            {"student_id": 9, "nickname": "Asha", "response_id": 31, "label": "understood",
             "misconception_label": null, "certainty": 0.86, "status": "settled", "source": "both"}
          ]},
          {"label": "guessed", "count": 2, "students": []}
        ]},
        {"is_correct": false, "count": 4, "labels": []}
      ],
      "wrong_answers": [
        {"answer": "1/5", "count": 3, "several_stories": true,
         "stories": [{"label": "misread", "misconception_label": null, "count": 1},
                     {"label": "misconception", "misconception_label": "Bigger denominator means bigger fraction", "count": 1},
                     {"label": "out_of_time", "misconception_label": null, "count": 1}],
         "students": [ "...StudentEntry objects as above..." ]}
      ]
    }
  ]
}
```
Groups: correct first, then incorrect; empty groups omitted.
`wrong_answers`: every wrong answer, grouped by value (`0.2` and `1/5` are the same answer), biggest group first, with the stories behind it. `several_stories` is true when one wrong answer has two or more *decided* stories — this is the Riddle 2 view: "3 students answered 1/5 — for 3 different reasons". `rule_only_count > 0` → show banner "Some answers were checked by rules only (AI unavailable)".

### `GET /api/responses/{response_id}` · teacher
`200` → **ResponseDetail**:
```json
{
  "response_id": 31, "student_id": 9, "nickname": "Asha",
  "question": { "...": "Quiz question object, as in PUT quiz response" },
  "answer": "3/4", "explanation": "...", "self_confidence": "sure", "is_correct": true,
  "time_spent_seconds": 34, "timed_out": false, "ran_out_of_time": false,
  "created_at": "...",
  "diagnosis": {
    "diagnosis_id": 40, "version": 2, "label": "understood", "misconception_id": null,
    "misconception_label": null, "certainty": 0.86, "source": "both", "status": "settled", "note": "",
    "created_at": "...",
    "hypotheses": [
      {"kind": "understood", "misconception_id": null, "misconception_label": null,
       "evidence_for": "I turned 1/2 into 2/4", "evidence_against": "", "likelihood": 0.86, "status": "supported",
       "would_confirm": "They explain a new pair, e.g. 1/3 + 1/6, the same way"},
      {"kind": "guessed", "misconception_id": null, "misconception_label": null, "evidence_for": "",
       "evidence_against": "Explains each step", "likelihood": 0.0, "status": "ruled_out", "would_confirm": ""}
    ]
  },
  "history": [{"version": 1, "label": "not_sure", "source": "both", "certainty": 0.55, "status": "open", "created_at": "..."}],
  "follow_up": {"question_text": "...", "student_reply": "...", "answered_at": "..."},
  "trace": [{"step": "rule_match", "source": "rule", "model": null, "prompt_version": null, "latency_ms": 1, "ok": true, "detail": "Correct answer"}]
}
```
`follow_up` may be `null`. `history` lists older versions (newest first), excluding the current one.
Hypotheses = every story weighed: `supported` (chosen), `open` (still possible — show its `would_confirm`), `ruled_out` (rejected — show `evidence_against` as the reason). Show all of them, not just the label: "Stories considered".

### `POST /api/responses/{response_id}/override` · teacher
Body `{"label": "misread", "misconception_id": null, "note": "Talked to her — she read 1/4 as 4."}`
`misconception_id` required when label is `misconception` (must belong to the question). note ≤500.
`200` → updated **ResponseDetail** (new version, `source: "teacher"`, old version moves to history). Teacher readings are final: later student replies never replace them.

### `POST /api/responses/{response_id}/ai-intervention` · teacher
Generates a 1-on-1 pedagogical desk intervention and conversational dialogue script based on the student's diagnosed cognitive story.
`200` → **AIInterventionOut**:
```json
{
  "student_nickname": "Asha",
  "diagnosed_label": "misconception",
  "misconception_name": "Adds across tops and bottoms",
  "misconception_breakdown": "The student treats numerators and denominators as independent whole numbers...",
  "one_on_one_script": [
    {"teacher_prompt": "If you have half a pizza and add a quarter, can the answer be smaller than half?", "anticipated_student_thinking": "Realizes the contradiction in 2/6 being smaller than 1/2."}
  ],
  "concrete_counterexample": "Show visual pizza quarters: 1/2 is already 2/4, so adding 1/4 gives 3/4.",
  "check_for_understanding_question": "Can you draw 1/3 + 1/6 using a common strip?",
  "generated_by_model": "gemini-3.5-flash-lite"
}
```

### `POST /api/classes/{class_id}/ai-generate-question` · teacher
Generates a diagnostic assessment question with cognitive distractors and researched misconceptions.
Body: `{"topic": "Ohm's Law", "grade_level": "High School", "misconception_focus": "Current gets used up"}`
`200` → **AIGenerateQuestionOut**:
```json
{
  "prompt": "In a series circuit with two identical bulbs, how does bulb A compare to bulb B?",
  "correct_answer": "Both bulbs are equally bright",
  "answer_type": "choice",
  "key_idea": "Current is conserved around a single loop and does not diminish.",
  "choices": ["Bulb A is brighter", "Both bulbs are equally bright", "Bulb B is brighter"],
  "misconceptions": [
    {
      "label": "Current wear-out model",
      "trigger_answers": ["Bulb A is brighter"],
      "signal_text": "first bulb takes the power",
      "remedy_hint": "Use water pipe analogy where fluid flow is constant everywhere in a closed pipe."
    }
  ],
  "time_limit_seconds": 90
}
```

### `POST /api/classes/{class_id}/ai-summary` · teacher
Synthesizes whole-classroom cognitive trends, dominant roadblocks, and provides a 10-minute reteach plan.
`200` → **AISummaryOut**:
```json
{
  "class_name": "7B Maths",
  "quiz_topic": "Fractions",
  "total_students": 24,
  "correct_count": 14,
  "accuracy_percentage": 58.3,
  "executive_summary": "Class 7B demonstrates that raw accuracy (58.3%) obscures two distinct cognitive groups...",
  "dominant_misconception": "Independent addition of numerators and denominators",
  "undercover_guessers_warning": "3 students correctly selected 3/4 without being able to explain common denominators.",
  "ten_minute_reteach_plan": [
    "Step 1: Visual hook displaying 1/2 vs 2/6 side by side.",
    "Step 2: Contrastive peer debate on denominator scaling.",
    "Step 3: Exit check with 1/3 + 1/6."
  ],
  "differentiated_groups": [
    {
      "group_name": "Needs Conceptual Grounding",
      "focus_story": "misconception",
      "student_count": 7,
      "student_nicknames": ["Asha", "Marcus"],
      "suggested_action": "Use concrete fraction circles before giving numerical problems."
    }
  ],
  "generated_by_model": "gemini-3.5-flash-lite"
}
```

