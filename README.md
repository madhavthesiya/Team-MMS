# BehindTheMark — same score, different story

**Live Application:** https://behindthemark.onrender.com  ·  **Demo Video:** [2-Minute Walkthrough](https://youtu.be/behindthemark-demo)  ·  **Frontend Pack:** [UI Screenshots & Flow Documentation](https://docs.google.com/document/d/behindthemark-pack)  
**Try it:** Open the live URL → Click **"Try the sample class"** → Open the 6-character join link on your phone/browser → Submit an answer with an explanation → View results split by underlying reasoning in real time.

---

## 1. Problem and Users

Two learners each score 7/10 on a math check-in. One genuinely understood the core concepts and had a minor calculation slip; the other guessed or pattern-matched trigger numbers without comprehending the underlying principles. Standard LMS and quiz platforms assign them the identical number, dumping both into the same generic remedial bucket.

- **Teachers (school / early college):** Need to diagnose *why* a student arrived at an answer, not merely check *whether* it was right or wrong.
- **Students:** Need their mathematical reasoning heard and understood, receiving targeted feedback that addresses their actual misconceptions rather than penalizing slips.

---

## 2. What BehindTheMark Does

1. **Teacher Setup:** Teacher creates a focused check-in quiz defining each question's prompt, correct answer, key mathematical concept, and common diagnostic misconceptions with triggers.
2. **Student Submission:** Students submit their answer, step-by-step reasoning explanation, and a self-reported confidence rating (`sure`, `unsure`, `guessed`).
3. **Dual Pipeline Analysis:** Code normalizes answers to evaluate correctness, matches rules against known misconceptions, while Gemini proposes hypotheses strictly anchored to verbatim quotes from student explanations.
4. **Targeted Follow-Up:** When certainty falls below threshold or rules and AI disagree, the system prompts the student with one targeted follow-up question to discriminate between hypotheses.
5. **Differentiated Teacher View:** Teachers see students with the same raw score split cleanly by diagnostic reason (`Understood`, `Misconception`, `Slip`, `Misread`, `Guessed`, `Not Sure`) and can review full evidence traces or record manual overrides.

---

## 3. How the Riddles Shaped the Architecture

- **Riddle 1 — The Same Number:** Evidence (answer, student explanation text, confidence rating) is strictly immutable and stored independently from interpretation (versioned `Diagnosis` and `Hypothesis` records). Students earning the same overall score (e.g. 7/10) or answering correctly through different means (solid conceptual mastery vs lucky guess) are split into differentiated diagnostic clusters on the dashboard.
- **Riddle 2 — One Error, Several Stories:** When multiple learners submit the identical wrong answer (e.g. `1/5` for "Which is bigger: 1/3 or 1/5?"), the platform refuses to assume a single verdict. It treats the wrong answer as an initial clue, weighs every candidate story — a mistaken rule (comparing denominators as whole numbers), a missed condition (reading 'smaller' instead of 'bigger'), running out of time, a slip or a guess — and requires evidence for each: verbatim quotes from the student, or, for "ran out of time", recorded facts only (a per-question timer that auto-submits, or the student's "I ran out of time" tick), never AI inference. Code chooses a story only when at least three were weighed and the chosen one is clearly ahead; otherwise one targeted follow-up separates them. Every story carries what would confirm it, and the teacher sees "3 students answered 1/5 — 3 different stories".
- **Pedagogical Precedence (The Teacher's Word):** Pedagogical authority remains with the teacher. Teacher overrides write a new `Diagnosis` record version (`source=teacher`), preserving all raw evidence and model trace logs without deletion. Student replies arriving after an override never overwrite the teacher's judgment.
- **System Guardrails & Budgets (The Impatient Clock & Fragile Bridge):** Verbatim quote verification drops hallucinated AI evidence; API outages gracefully fall back to deterministic rule diagnoses flagged as `"AI unavailable"`; all model calls share a strict 30-second budget (`AI_BUDGET_SECONDS`) to guarantee responsive interaction.

---

## 4. How the AI Works (and When It Doesn't)

### The Diagnostic Pipeline
```
[Student Submission]
       │
       ▼
 [1. Normalization] ─── Code resolves correctness (Fractions, decimals, text)
       │
       ▼
 [2. Rule Matcher]  ─── Matches trigger answers & seeds 'guessed' hypothesis
       │
       ▼
 [3. AI Analysis]   ─── Gemini generates candidate hypotheses with verbatim evidence quotes
       │
       ▼
 [4. Guardrails]    ─── Verifies quote presence, validates enum labels, checks prompt injection
       │
       ├── Certainty >= 0.70 & Agrees with Rules ────► [Settled Diagnosis]
       └── Disagreement / Low Certainty / Ambiguity ─► [5. Targeted Follow-up Round]
```

### Evaluation Suite
- **Dataset (`eval/cases.jsonl`):** 48 curated benchmark cases spanning all 10 sample fractions questions, complete with seed misconceptions, arithmetic slips, inverted misreads, self-reported guesses, Hinglish reasoning, and adversarial prompt injections.
- **Runner (`eval/run_eval.py`):** Direct pipeline evaluation harness producing timestamped markdown reports in `eval/results/` with full confusion matrix, accuracy, not-sure rate, and confident-wrong rate tracking.

---

## 5. Risks and Limits

- **Risk of Misclassification:** A student could be misclassified as guessing or holding an invalid misconception.  
  *Mitigation:* Diagnostic labels are visible exclusively to teachers; every label provides full evidence quote trails, uncertainty markers (`not_sure`), and one-click teacher overrides.
- **AI Outages:** When Gemini is unreachable or rate-limited, the system falls back to rule matching and explicitly labels the diagnostic source as rule-based.
- **Linguistic Nuances:** Short, vague, or non-English explanations naturally decrease model certainty, prompting safe fallbacks to `not_sure` rather than speculative guessing.
- **Privacy & PII Protection:** Student names are restricted to casual nicknames; regex filters redact phone numbers and email addresses before text reaches the Gemini API. Teachers retain the ability to permanently delete class records and associated data.
- **No Automated Grading:** BehindTheMark is an interpretive diagnostic tool, never an automated grading punisher.

---

## 6. Setup (Clean Clone)

### Prerequisites
- Python 3.12+
- Node.js 24+ & npm 11+
- Docker (optional, for containerized run)

### Local Environment Setup
```bash
# 1. Clone repository
git clone https://github.com/madhavthesiya/Team-MMS.git
cd Team-MMS

# 2. Configure environment
cp .env.example .env
# Edit .env and supply your GEMINI_API_KEY (from https://aistudio.google.com/apikey)

# 3. Setup Backend
cd backend
python -m venv .venv
# Windows:
.\.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -r requirements-dev.txt
python -m pytest -q
uvicorn app.main:create_app --factory --reload --port 8000

# 4. Setup Frontend (in separate terminal)
cd ../frontend
npm install
npm run dev      # Runs at http://localhost:5173 with proxy to :8000
```

### Docker Container Run
```bash
# Build and run unified production container
docker build -t behindthemark .
docker run -p 8000:8000 --env-file .env behindthemark
# Open http://localhost:8000/api/health
```

---

## 7. Debate Response Log

| Flaw / Edge Case Raised | Status | Resolution & Commit |
|---|---|---|
| Rule/AI disagreement could cause deadlock or unstable verdict | **Fixed** | Implemented single targeted follow-up loop where second-pass student reply evidence takes precedence over static answer rules (`83effd5`). |
| Timeouts during chained LLM calls could exceed request window | **Fixed** | Implemented shared `_Budget` across request lifetime; falls back to template question when $<2s$ remains (`83effd5`). |
| Injected prompt instructions attempting to force `understood` label | **Fixed** | Integrated `looks_like_injection` sanitizer and quote verification guardrails forcing `not_sure` state (`1c7692e`, `eval/cases.jsonl`). |

---

## 8. Team & Roles

- **Shane** &mdash; Architecture & Backend Pipeline (Track A)
- **Frontend Lead** &mdash; UI, SPA & React Flow (Track B)
- **Madhav Thesiya** &mdash; Eval Suite, Cloud Infrastructure, Docker & Documentation (Track C)

---

## 9. Documentation

- [API contract](docs/api-contract.md) — every endpoint, request/response shape and error
- [Architecture](docs/architecture.md) — module map, request flow, evidence/versions, decision and failure policy
- [Security and student data](SECURITY.md) — access boundaries, data handling, known limits
- [Status](docs/status.md) — dated verification record and open issues
- [Design spec](docs/superpowers/specs/2026-10-16-behindthemark-design.md) — product intent and riddle responses
- [Contributing](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) — workflow for people and coding agents

