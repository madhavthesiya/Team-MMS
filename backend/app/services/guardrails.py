"""Code-side checks on model output. The AI proposes; these rules decide what survives."""
import re
from dataclasses import dataclass

from app.ai.schemas import AIAnalysis
from app.domain import HypothesisOut, Label, QuestionSpec, StudentWork
from app.services.normalizer import normalize_text, parse_number
from app.services.rule_matcher import timing_evidence

_CORRECT_ONLY = {"understood"}
_INCORRECT_ONLY = {"misread", "misconception", "slip", "out_of_time"}
_QUOTE_EDGE = "\"'“”‘’ .,"
_INJECTION = re.compile(
    r"ignore (all |any )?(of )?(the |your )?(previous|prior|above|earlier) (instructions|rules|prompts?)"
    r"|disregard (the|all|your|any) (instructions|rules)"
    r"|\b(system|assistant)\s*:"
    r"|\b(mark|label|classify|grade) (me|this|my answer)( as)? (understood|correct)"
    r"|\blabel\s*=",
    re.IGNORECASE,
)
_NUMBER_TOKEN = re.compile(r"-?\d+(?:\.\d+)?(?:\s*/\s*\d+)?%?|[¼-¾⅐-⅞]")


@dataclass(frozen=True)
class GuardedAnalysis:
    label: Label
    certainty: float
    misconception_id: int | None
    hypotheses: tuple[HypothesisOut, ...]
    notes: tuple[str, ...]
    ruled_out: tuple[HypothesisOut, ...] = ()  # stories weighed and rejected, with the reason


def _norm(text: str) -> str:
    return " ".join(text.casefold().split())


def quote_in(quote: str, text: str) -> bool:
    """True if `quote` appears in `text`, ignoring case, spacing and surrounding quote marks."""
    q = _norm(quote).strip(_QUOTE_EDGE)
    return bool(q) and q in _norm(text)


def looks_like_injection(text: str) -> bool:
    """Student text that tries to instruct the model. We then skip the AI and flag it for the teacher."""
    return bool(_INJECTION.search(text))


def leaks_answer(question_text: str, question: QuestionSpec) -> bool:
    """True if a follow-up question would reveal the correct answer (in any equivalent number form)."""
    if question.answer_type == "number":
        target = parse_number(question.correct_answer)
        if target is not None:
            return any(parse_number(tok) == target for tok in _NUMBER_TOKEN.findall(question_text))
    answer = normalize_text(question.correct_answer)
    return bool(answer) and f" {answer} " in f" {normalize_text(question_text)} "


def apply_guardrails(
    analysis: AIAnalysis, question: QuestionSpec, work: StudentWork, is_correct: bool
) -> GuardedAnalysis:
    valid_ids = {m.id for m in question.misconceptions}
    student_text = "\n".join([work.answer, work.explanation, work.follow_up_reply or ""])
    timing = timing_evidence(question, work)
    notes: list[str] = []
    kept: list[HypothesisOut] = []

    def impossible(kind: str) -> bool:
        return (kind in _CORRECT_ONLY and not is_correct) or (kind in _INCORRECT_ONLY and is_correct)

    for h in analysis.hypotheses:
        if impossible(h.kind):
            notes.append(f"dropped '{h.kind}': impossible for a {'correct' if is_correct else 'wrong'} answer")
            continue
        misconception_id = h.misconception_id if h.kind == "misconception" else None
        if h.kind == "misconception" and misconception_id not in valid_ids:
            notes.append("dropped 'misconception': not one of the teacher's misconceptions")
            continue
        if h.kind == "out_of_time":
            if timing is None:
                notes.append("dropped 'out_of_time': no timer or student report says they ran out of time")
                continue
            evidence = timing
        elif quote_in(h.evidence_quote, student_text):
            evidence = h.evidence_quote.strip()
        elif h.kind == "guessed" and work.self_confidence == "guessed":
            evidence = "Student said they guessed"
        else:
            notes.append(f"dropped '{h.kind}': quoted evidence not found in the student's words")
            continue
        kept.append(
            HypothesisOut(
                kind=h.kind,
                misconception_id=misconception_id,
                evidence_for=evidence,
                evidence_against=h.evidence_against.strip(),
                likelihood=h.likelihood,
                would_confirm=h.would_confirm.strip(),
            )
        )
    kept.sort(key=lambda h: h.likelihood, reverse=True)

    kept_keys = {(h.kind, h.misconception_id) for h in kept}
    ruled_out: list[HypothesisOut] = []
    for r in analysis.alternatives_ruled_out:
        misconception_id = r.misconception_id if r.kind == "misconception" and r.misconception_id in valid_ids else None
        key = (r.kind, misconception_id)
        if impossible(r.kind) or key in kept_keys or (r.kind == "misconception" and misconception_id is None):
            continue
        kept_keys.add(key)
        ruled_out.append(
            HypothesisOut(kind=r.kind, misconception_id=misconception_id, evidence_for="",
                          evidence_against=r.reason.strip(), likelihood=0.0, status="ruled_out")
        )

    label: Label = analysis.label
    misconception_id = analysis.misconception_id if label == "misconception" else None
    if label == "misconception" and misconception_id is None:
        misconception_id = next((h.misconception_id for h in kept if h.kind == "misconception"), None)
    if label != "not_sure":
        backed = any(
            h.kind == label and (label != "misconception" or h.misconception_id == misconception_id) for h in kept
        )
        if not backed:
            notes.append(f"label '{label}' had no surviving evidence, so not sure")
            label, misconception_id = "not_sure", None
    return GuardedAnalysis(label, analysis.certainty, misconception_id, tuple(kept), tuple(notes), tuple(ruled_out))
