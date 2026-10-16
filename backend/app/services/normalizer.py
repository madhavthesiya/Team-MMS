"""Answer normalisation. Code — never the AI — decides whether an answer is correct."""
import re
import unicodedata
from fractions import Fraction

from app.domain import AnswerType

_MIXED = re.compile(r"^(-?\d+)\s+(\d+)\s*/\s*(\d+)$")
_TEXT_JUNK = re.compile(r"[^\w/.%-]+")


def _vulgar_value(ch: str) -> Fraction | None:
    """Value of a single vulgar-fraction character such as '¾', else None."""
    if unicodedata.category(ch) != "No" or ch.isdigit():
        return None
    try:
        return Fraction(unicodedata.numeric(ch)).limit_denominator(100)
    except (TypeError, ValueError):
        return None


def _combine(whole: int, frac: Fraction) -> Fraction:
    return whole - frac if whole < 0 else whole + frac


def parse_number(raw: str) -> Fraction | None:
    """Parse '3/4', '0.75', '75%', '¾', '1 1/2', '1½' into an exact Fraction. None if not a number."""
    s = raw.strip().replace(",", "")
    if not s or len(s) > 50:
        return None
    tail = _vulgar_value(s[-1])
    if tail is not None:
        head = s[:-1].strip()
        if not head:
            return tail
        return _combine(int(head), tail) if head.lstrip("-").isdigit() else None
    s = unicodedata.normalize("NFKC", s).replace("⁄", "/")
    try:
        mixed = _MIXED.match(s)
        if mixed:
            whole, num, den = (int(g) for g in mixed.groups())
            return _combine(whole, Fraction(num, den))
        s = s.replace(" ", "")
        if s.endswith("%"):
            return Fraction(s[:-1]) / 100
        return Fraction(s)
    except (ValueError, ZeroDivisionError):
        return None


def normalize_text(raw: str) -> str:
    """Casefold, keep letters/digits and the maths characters / . % -, collapse everything else to one space."""
    s = unicodedata.normalize("NFKC", raw).casefold()
    s = _TEXT_JUNK.sub(" ", s)
    return " ".join(s.split()).strip(" .")


def normalize_answer(raw: str, answer_type: AnswerType) -> str:
    if answer_type == "number":
        value = parse_number(raw)
        if value is not None:
            return f"{value.numerator}/{value.denominator}"
    return normalize_text(raw)


def answers_match(given: str, expected: str, answer_type: AnswerType) -> bool:
    return normalize_answer(given, answer_type) == normalize_answer(expected, answer_type)
