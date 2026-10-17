#!/usr/bin/env python3
"""BehindTheMark CLI Demonstration Tool

Runs the cognitive diagnostic assessment pipeline directly from your terminal.
Demonstrates:
  - Riddle 1: Decoupling correctness computation from AI reasoning (Asha vs. Leo).
  - Riddle 2: Competing hypotheses (Misconception vs Slip vs Timeout).
  - Invariants: Verbatim quote checks, timing facts, and honest fallback.

Usage:
  python backend/app/demo.py --case asha
  python backend/app/demo.py --case leo
  python backend/app/demo.py --case misconception
  python backend/app/demo.py --case timeout
  python backend/app/demo.py --interactive
"""

import argparse
import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from app.ai.client import NullAIClient, build_ai_client
from app.config import get_settings
from app.domain import MisconceptionSpec, QuestionSpec, StudentWork
from app.services.pipeline import run_diagnosis

SAMPLE_QUESTION = QuestionSpec(
    prompt="What is 1/2 + 1/4?",
    correct_answer="3/4",
    answer_type="number",
    key_idea="Find a common denominator before adding fraction numerators",
    misconceptions=(
        MisconceptionSpec(
            id=1,
            label="Added across top and bottom",
            trigger_answers=("2/6", "1/3"),
            signal_text="added numerators and added denominators",
            remedy_hint="Fractions must share equal part sizes before combining",
        ),
        MisconceptionSpec(
            id=2,
            label="Multiplied denominators instead of finding LCM",
            trigger_answers=("6/8",),
            signal_text="multiplied denominators",
            remedy_hint="Check if the smaller denominator divides into the larger",
        ),
    ),
    time_limit_seconds=60,
)

PRESET_CASES = {
    "asha": StudentWork(
        answer="2/4",
        explanation="1/2 is equal to 2/4. Then I accidentally subtracted 1/4 instead of adding 1/4 to get 3/4.",
        self_confidence="sure",
        time_spent_seconds=24,
    ),
    "leo": StudentWork(
        answer="3/4",
        explanation="I don't know fractions, I just guessed 3/4 because 3 and 4 were the numbers in the question.",
        self_confidence="guessed",
        time_spent_seconds=8,
    ),
    "misconception": StudentWork(
        answer="2/6",
        explanation="1 + 1 = 2 on top, and 2 + 4 = 6 on the bottom, so the answer is 2/6.",
        self_confidence="sure",
        time_spent_seconds=30,
    ),
    "timeout": StudentWork(
        answer="2/6",
        explanation="I was still working on finding common denominators when the timer ran out.",
        self_confidence="unsure",
        time_spent_seconds=60,
        timed_out=True,
    ),
}


def print_banner():
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    print("=" * 65)
    print("      BehindTheMark - Cognitive Diagnostic Assessment CLI")
    print("           Team MMS: Madhav | Meet | Shane")
    print("=" * 65)


def render_outcome(case_name: str, work: StudentWork, outcome):
    print(f"\n[Scenario: {case_name.upper()}]")
    print("-" * 65)
    print(f"Question       : {SAMPLE_QUESTION.prompt} (Correct: {SAMPLE_QUESTION.correct_answer})")
    print(f"Student Answer : {work.answer} (Confidence: {work.self_confidence})")
    print(f"Explanation    : \"{work.explanation}\"")
    if work.timed_out:
        print(f"Timing         : {work.time_spent_seconds}s (TIMED OUT auto-submit)")
    else:
        print(f"Timing         : {work.time_spent_seconds}s")
    print("-" * 65)

    # 1. Correctness (Riddle 1 Invariant)
    corr_symbol = "[PASS] CORRECT" if outcome.is_correct else "[FAIL] INCORRECT"
    print(f"\n1. DETERMINISTIC CODE GRADING (Riddle 1 Invariant):")
    print(f"   Result       : {corr_symbol}")
    print(f"   Note         : Computed strictly by Python Fraction normalizer; AI never sets correctness.")

    # 2. Cognitive Diagnostic Label (Riddle 2 Invariant)
    print(f"\n2. COGNITIVE DIAGNOSIS (Riddle 2 Competing Hypotheses):")
    print(f"   Label        : {outcome.label.upper()}")
    print(f"   Certainty    : {outcome.certainty:.0%}")
    print(f"   Source       : {outcome.source.upper()} (AI Available: {outcome.ai_available})")
    print(f"   Status       : {outcome.status.upper()}")

    # 3. Competing Hypotheses Weighed
    print(f"\n3. COMPETING HYPOTHESES WEIGHED:")
    for h in outcome.hypotheses:
        lead = "* SELECTED" if h.kind == outcome.label else "  REJECTED"
        misc = f" (Misconception #{h.misconception_id})" if h.misconception_id else ""
        print(f"   [{lead}] {h.kind.upper():<14}{misc}")
        if h.evidence_for:
            print(f"                 Evidence: \"{h.evidence_for}\"")

    # 4. Follow-up Check (Riddle 3)
    if outcome.follow_up_question:
        print(f"\n4. RIDDLE 3 TARGETED FOLLOW-UP (Max 1 Question):")
        print(f"   Question     : \"{outcome.follow_up_question}\"")
        if outcome.follow_up_discriminates:
            print(f"   Separates    : {' vs '.join(outcome.follow_up_discriminates)}")

    # 5. Pedagogical Summary
    print(f"\n5. PEDAGOGICAL TAKEAWAY:")
    if case_name == "asha":
        print("   -> Asha got 0 points on the math check, but possesses strong conceptual understanding.")
        print("   -> Traditional tools would group her in remedial tutoring; BehindTheMark tags this as a SLIP.")
    elif case_name == "leo":
        print("   -> Leo got full marks, but admitted to guessing without understanding.")
        print("   -> Traditional tools mark him 'Mastered'; BehindTheMark flags him for instructional follow-up.")
    elif case_name == "misconception":
        print("   -> Classic 'Add across top and bottom' misconception cleanly identified with verbatim quote.")
        print("   -> Triggers recommended visual area-model reteach plan in teacher cockpit.")
    elif case_name == "timeout":
        print("   -> Rushed work verified by server timer telemetry; AI is forbidden from guessing rushed state.")
    print("=" * 65 + "\n")


def main():
    parser = argparse.ArgumentParser(description="BehindTheMark Diagnostic Pipeline CLI Demo")
    parser.add_argument(
        "--case",
        choices=["asha", "leo", "misconception", "timeout"],
        help="Run a curated scenario demonstrating educational riddles",
    )
    parser.add_argument(
        "--interactive",
        action="store_true",
        help="Run an interactive session with custom input",
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="Attempt live Gemini API call if GEMINI_API_KEY is configured (defaults to offline NullAIClient)",
    )

    args = parser.parse_args()

    print_banner()

    # Determine AI client
    settings = get_settings()
    if args.live and settings.gemini_api_key:
        print("Using live Gemini AI client.\n")
        ai_client = build_ai_client(settings)
    else:
        print("Using offline deterministic pipeline (rule + heuristic matcher, 0 network calls).\n")
        ai_client = NullAIClient()

    if args.interactive:
        print("Enter student submission data:")
        ans = input("Answer (e.g., 2/6, 3/4, 2/4): ").strip()
        exp = input("Written Explanation: ").strip()
        conf = input("Confidence [sure / unsure / guessed]: ").strip().lower()
        if conf not in ("sure", "unsure", "guessed"):
            conf = "unsure"
        work = StudentWork(
            answer=ans,
            explanation=exp,
            self_confidence=conf,
            time_spent_seconds=20,
        )
        outcome = run_diagnosis(SAMPLE_QUESTION, work, ai=ai_client, threshold=0.70, allow_follow_up=True)
        render_outcome("interactive", work, outcome)
        return

    case = args.case or "asha"
    work = PRESET_CASES[case]
    outcome = run_diagnosis(SAMPLE_QUESTION, work, ai=ai_client, threshold=0.70, allow_follow_up=True)
    render_outcome(case, work, outcome)


if __name__ == "__main__":
    main()
