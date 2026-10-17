# BehindTheMark — Diagnostic Evaluation Suite

The `eval/` package provides an empirical evaluation harness that benchmarks the BehindTheMark reasoning pipeline against 51 curated, real-world student responses across 10 diagnostic math topics.

---

## 1. Directory Structure

```text
eval/
├── cases.jsonl       # 51 curated benchmark cases with expected diagnostic labels
├── run_eval.py       # Evaluation runner measuring accuracy, not_sure rate, and confusion matrix
└── results/          # Generated markdown reports tracking performance across runs
    ├── 2026-10-17-0014.md
    └── 2026-10-17-0629.md
```

---

## 2. Benchmark Dataset (`cases.jsonl`)

The 51 cases test common student cognitive patterns and adversarial edge cases:
- **Concept Understood:** Correct answers backed by sound step-by-step reasoning.
- **Specific Misconceptions:** Pre-cataloged student misconceptions (e.g., adding tops and bottoms, comparing denominators as whole numbers, cross-multiplying on simple fractions).
- **Careless Slips:** Sound conceptual methods combined with simple arithmetic calculation or copying typos.
- **Prompt Misreads:** Answering a valid mathematical question, but inverting or misreading the question condition (e.g., picking the smaller fraction instead of the larger).
- **Guessed Answers:** Lucky right answers or blind wrong guesses with honest or self-reported uncertainty.
- **Out of Time Telemetry:** Timed-out submissions verified via server telemetry.
- **Adversarial & Edge Cases:** Prompt injections attempting to force `understood` verdicts, empty inputs, rambling text, and Hinglish explanations.

---

## 3. Evaluation Metrics

The runner evaluates the pipeline against four primary metrics:
1. **Exact Label Match (%):** Proportion of cases where the pipeline's diagnostic label exactly matches the pedagogical ground-truth label.
2. **Not Sure Rate (%):** Frequency with which the system conservatively declines to commit to a story when certainty is low, deferring to the teacher.
3. **Confident & Wrong Rate (%):** *The most critical safety metric* — how often the system assigned high confidence to an incorrect diagnosis. The goal is to minimize this to near zero.
4. **Full Confusion Matrix:** A 7x7 matrix tracking predictions across all diagnostic categories (`understood`, `misread`, `misconception`, `guessed`, `slip`, `out_of_time`, `not_sure`).

---

## 4. Running the Evaluation Suite

```bash
# Run against the deterministic rule fallback baseline (no API key required)
python eval/run_eval.py --rule-only

# Run against live Google Gemini with rate-limit pacing (requires GEMINI_API_KEY in .env)
python eval/run_eval.py
```

Outputs are automatically written to a timestamped markdown report in `eval/results/`.
