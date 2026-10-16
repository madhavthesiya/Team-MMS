"""Convert stored or submitted questions into the plain QuestionSpec the pipeline works on."""
from app.domain import MisconceptionSpec, QuestionSpec
from app.models import Question
from app.schemas import QuestionIn


def spec_from_question(question: Question) -> QuestionSpec:
    return QuestionSpec(
        prompt=question.prompt,
        correct_answer=question.correct_answer,
        answer_type=question.answer_type,
        key_idea=question.key_idea,
        misconceptions=tuple(
            MisconceptionSpec(
                id=m.id,
                label=m.label,
                trigger_answers=tuple(m.trigger_answers),
                signal_text=m.signal_text,
                remedy_hint=m.remedy_hint,
            )
            for m in question.misconceptions
        ),
    )


def spec_from_input(question: QuestionIn, misconception_ids: list[int]) -> QuestionSpec:
    """For questions not in the database (the eval runner): caller supplies one id per misconception."""
    if len(misconception_ids) != len(question.misconceptions):
        raise ValueError("need exactly one id per misconception")
    return QuestionSpec(
        prompt=question.prompt,
        correct_answer=question.correct_answer,
        answer_type=question.answer_type,
        key_idea=question.key_idea,
        misconceptions=tuple(
            MisconceptionSpec(
                id=mid,
                label=m.label,
                trigger_answers=tuple(m.trigger_answers),
                signal_text=m.signal_text,
                remedy_hint=m.remedy_hint,
            )
            for mid, m in zip(misconception_ids, question.misconceptions)
        ),
    )
