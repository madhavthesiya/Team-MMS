from fractions import Fraction

import pytest

from app.domain import MisconceptionSpec, QuestionSpec, StudentWork
from app.services.normalizer import answers_match, normalize_text, parse_number
from app.services.redact import redact_pii
from app.services.rule_matcher import rule_diagnose


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("3/4", Fraction(3, 4)),
        (" 3 / 4 ", Fraction(3, 4)),
        ("0.75", Fraction(3, 4)),
        ("75%", Fraction(3, 4)),
        ("¾", Fraction(3, 4)),
        ("1 1/2", Fraction(3, 2)),
        ("1½", Fraction(3, 2)),
        ("-1/2", Fraction(-1, 2)),
        ("15", Fraction(15)),
        ("1,000", Fraction(1000)),
    ],
)
def test_parse_number_accepts_common_forms(raw, expected):
    assert parse_number(raw) == expected


@pytest.mark.parametrize("raw", ["", "abc", "1/0", "three quarters", "1/2/3", "x½"])
def test_parse_number_rejects_non_numbers(raw):
    assert parse_number(raw) is None


def test_number_answers_match_by_value():
    assert answers_match("0.75", "3/4", "number")
    assert answers_match("6/8", "3/4", "number")
    assert not answers_match("0.7", "3/4", "number")


def test_text_answers_ignore_case_spacing_and_commas_but_not_form():
    assert answers_match("2/5,1/2,3/4", "2/5, 1/2, 3/4", "text")
    assert not answers_match("6/10", "3/5", "text")  # "simplest form" questions use text on purpose


def test_choice_answers_ignore_case_and_trailing_period():
    assert answers_match("YES.", "Yes", "choice")


def test_normalize_text_keeps_fraction_characters():
    assert normalize_text("  Two-thirds:  2/3! ") == "two-thirds 2/3"


Q = QuestionSpec(
    prompt="What is 1/2 + 1/4?",
    correct_answer="3/4",
    answer_type="number",
    key_idea="Common denominator.",
    misconceptions=(MisconceptionSpec(id=7, label="Adds tops and bottoms", trigger_answers=("2/6",)),),
)


def _w(answer: str, confidence: str = "sure") -> StudentWork:
    return StudentWork(answer=answer, explanation="", self_confidence=confidence)


def test_rules_correct_answer_is_understood_unless_student_guessed():
    assert rule_diagnose(Q, _w("0.75")).label == "understood"
    assert rule_diagnose(Q, _w("3/4", "guessed")).label == "guessed"


def test_rules_match_misconception_by_equivalent_value():
    r = rule_diagnose(Q, _w("1/3"))  # 1/3 == 2/6
    assert (r.is_correct, r.label, r.misconception_id) == (False, "misconception", 7)


def test_rules_have_no_opinion_on_unknown_wrong_answer():
    assert rule_diagnose(Q, _w("5/8")).label == "not_sure"
    assert rule_diagnose(Q, _w("5/8", "guessed")).label == "guessed"


def test_redacts_email_and_phone():
    assert redact_pii("mail asha.k@example.co.in now") == "mail [email removed] now"
    assert redact_pii("call +91 98765 43210 today") == "call [phone removed] today"


@pytest.mark.parametrize("text", ["1/2 + 1/4 = 3/4", "20 ÷ 4 = 5 then 3 × 5 = 15", "0.6 = 6/10 = 3/5"])
def test_redaction_leaves_maths_alone(text):
    assert redact_pii(text) == text
