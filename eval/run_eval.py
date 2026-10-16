"""Run the labelled eval set against the REAL pipeline and Gemini.

Usage (from repo root, backend venv active, GEMINI_API_KEY in .env):
    python eval/run_eval.py
Writes a markdown report to eval/results/.
"""
import collections
import datetime as dt
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.ai.client import build_ai_client  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.domain import StudentWork  # noqa: E402
from app.services.pipeline import run_diagnosis  # noqa: E402
from app.services.sample import load_sample_quiz  # noqa: E402
from app.services.specs import spec_from_input  # noqa: E402

LABELS = ["understood", "misread", "misconception", "guessed", "slip", "out_of_time", "not_sure"]


def build_specs():
    quiz = load_sample_quiz()
    specs, next_id = [], 1
    for question in quiz.questions:
        ids = list(range(next_id, next_id + len(question.misconceptions)))
        next_id += len(ids)
        specs.append(spec_from_input(question, ids))
    return specs


def main() -> None:
    settings = get_settings()
    rule_only_flag = "--rule-only" in sys.argv or "--fallback-only" in sys.argv
    if not settings.gemini_api_key and not rule_only_flag:
        sys.exit(
            "Set GEMINI_API_KEY in .env first — the eval runs against the real model.\n"
            "(To evaluate the rule-engine fallback baseline without an API key, pass --rule-only)"
        )
    delay = float(os.environ.get("EVAL_DELAY_SECONDS", "4" if not rule_only_flag else "0"))
    ai = build_ai_client(settings)
    specs = build_specs()
    lines = (ROOT / "eval" / "cases.jsonl").read_text(encoding="utf-8").splitlines()
    cases = [json.loads(line) for line in lines if line.strip()]

    rows, confusion = [], collections.Counter()
    for case in cases:
        # Riddle 2 timing facts (optional per case): recorded, never inferred by the model.
        timing = dict(
            timed_out=case.get("timed_out", False),
            reported_out_of_time=case.get("ran_out_of_time", False),
            time_spent_seconds=case.get("time_spent_seconds"),
        )
        work = StudentWork(
            answer=case["answer"],
            explanation=case["explanation"],
            self_confidence=case["self_confidence"],
            **timing,
        )
        spec = specs[case["question"] - 1]
        out = run_diagnosis(
            spec,
            work,
            ai,
            threshold=settings.certainty_threshold,
            allow_follow_up=bool(case.get("follow_up_reply")),
            budget_seconds=settings.ai_budget_seconds,
        )
        if out.follow_up_question and case.get("follow_up_reply"):
            time.sleep(delay)
            work = StudentWork(
                answer=case["answer"],
                explanation=case["explanation"],
                self_confidence=case["self_confidence"],
                follow_up_question=out.follow_up_question,
                follow_up_reply=case["follow_up_reply"],
                **timing,
            )
            out = run_diagnosis(
                spec,
                work,
                ai,
                threshold=settings.certainty_threshold,
                allow_follow_up=False,
                budget_seconds=settings.ai_budget_seconds,
            )
        confusion[(case["expected"], out.label)] += 1
        rows.append((case, out))
        print(
            f"{case['id']:<28} expected={case['expected']:<13} got={out.label:<13} "
            f"certainty={out.certainty:.2f} source={out.source} ai={'yes' if out.ai_available else 'NO'}"
        )
        time.sleep(delay)

    total = len(rows)
    correct = sum(1 for c, o in rows if o.label == c["expected"])
    not_sure = sum(1 for _, o in rows if o.label == "not_sure")
    confident_wrong = sum(1 for c, o in rows if o.label not in ("not_sure", c["expected"]))
    ai_down = sum(1 for _, o in rows if not o.ai_available)

    stamp = dt.datetime.now().strftime("%Y-%m-%d-%H%M")
    report = [
        f"# Eval run {stamp}",
        "",
        f"Model: `{settings.gemini_model if not rule_only_flag else 'rule-fallback-only'}` · threshold {settings.certainty_threshold} · cases with follow_up_reply get one follow-up round",
        "",
        f"- Cases: {total}",
        f"- Exact label match: {correct}/{total} ({correct / total:.0%})",
        f"- Not sure: {not_sure}/{total} ({not_sure / total:.0%})",
        f"- Confident and wrong: {confident_wrong}/{total} ({confident_wrong / total:.0%})  ← the number that matters",
        f"- AI unavailable (rule fallback): {ai_down}",
        "",
        "## Confusion matrix (rows = expected, columns = predicted)",
        "",
        "| expected \\ got | " + " | ".join(LABELS) + " |",
        "|---|" + "---|" * len(LABELS),
    ]
    for exp in LABELS:
        report.append(f"| {exp} | " + " | ".join(str(confusion[(exp, got)]) for got in LABELS) + " |")
    report += ["", "## Mismatches", "", "| id | expected | got | certainty | source |", "|---|---|---|---|---|"]
    for case, out in rows:
        if out.label != case["expected"]:
            report.append(f"| {case['id']} | {case['expected']} | {out.label} | {out.certainty:.2f} | {out.source} |")

    out_path = ROOT / "eval" / "results" / f"{stamp}.md"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(report) + "\n", encoding="utf-8")
    print(f"\nReport written to {out_path}")


if __name__ == "__main__":
    main()
