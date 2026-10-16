"""Runs the pipeline for stored responses and saves each reading as a new Diagnosis version."""
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.ai.client import AIClient
from app.config import Settings
from app.domain import StudentWork
from app.models import AIRun, Diagnosis, FollowUp, Hypothesis, Question, Response, Student, utcnow
from app.schemas import OverrideIn, ResponseIn
from app.services.errors import ConflictError, InvalidInputError, NotFoundError
from app.services.pipeline import DiagnosisOutcome, run_diagnosis
from app.services.redact import redact_pii
from app.services.specs import spec_from_question


def store_outcome(db: Session, response: Response, outcome: DiagnosisOutcome) -> Diagnosis:
    version = len(response.diagnoses) + 1
    diagnosis = Diagnosis(
        response=response,
        version=version,
        label=outcome.label,
        certainty=outcome.certainty,
        source=outcome.source,
        status=outcome.status,
        misconception_id=outcome.misconception_id,
    )
    diagnosis.hypotheses = [
        Hypothesis(
            kind=h.kind,
            misconception_id=h.misconception_id,
            evidence_for=h.evidence_for,
            evidence_against=h.evidence_against,
            likelihood=h.likelihood,
            status=h.status,
        )
        for h in outcome.hypotheses
    ]
    diagnosis.runs = [
        AIRun(
            step=s.step, source=s.source, model=s.model, prompt_version=s.prompt_version,
            latency_ms=s.latency_ms, ok=s.ok, detail=(s.detail or "")[:200],
        )
        for s in outcome.trace
    ]
    if outcome.follow_up_question:
        diagnosis.follow_up = FollowUp(
            question_text=outcome.follow_up_question, discriminates=list(outcome.follow_up_discriminates)
        )
    db.add(diagnosis)
    db.flush()
    return diagnosis


def submit_response(
    db: Session, student: Student, body: ResponseIn, ai: AIClient, settings: Settings
) -> tuple[Response, FollowUp | None]:
    question = db.get(Question, body.question_id)
    if question is None or question.quiz.class_id != student.class_id:
        raise NotFoundError("That question isn't in your class.")
    already = db.scalar(
        select(Response.id).where(Response.student_id == student.id, Response.question_id == question.id)
    )
    if already is not None:
        raise ConflictError("You already answered this question.")

    work = StudentWork(answer=body.answer, explanation=redact_pii(body.explanation), self_confidence=body.self_confidence)
    outcome = run_diagnosis(
        spec_from_question(question), work, ai, threshold=settings.certainty_threshold, allow_follow_up=True
    )
    response = Response(
        student=student,
        question=question,
        answer_raw=body.answer,
        explanation_raw=work.explanation,
        self_confidence=body.self_confidence,
        is_correct=outcome.is_correct,
    )
    db.add(response)
    try:
        db.flush()
    except IntegrityError as exc:  # two tabs submitting the same question at once
        db.rollback()
        raise ConflictError("You already answered this question.") from exc
    diagnosis = store_outcome(db, response, outcome)
    return response, diagnosis.follow_up


def reply_to_follow_up(
    db: Session, student: Student, follow_up_id: int, reply: str, ai: AIClient, settings: Settings
) -> Diagnosis:
    follow_up = db.get(FollowUp, follow_up_id)
    if follow_up is None or follow_up.diagnosis.response.student_id != student.id:
        raise NotFoundError("Follow-up not found.")
    if follow_up.student_reply is not None:
        raise ConflictError("You already answered this follow-up.")
    follow_up.student_reply = redact_pii(reply)
    follow_up.answered_at = utcnow()

    response = follow_up.diagnosis.response
    work = StudentWork(
        answer=response.answer_raw,
        explanation=response.explanation_raw,
        self_confidence=response.self_confidence,
        follow_up_question=follow_up.question_text,
        follow_up_reply=follow_up.student_reply,
    )
    # One follow-up only: if it is still unclear after the reply, it goes to the teacher as "not sure".
    outcome = run_diagnosis(
        spec_from_question(response.question), work, ai, threshold=settings.certainty_threshold, allow_follow_up=False
    )
    return store_outcome(db, response, outcome)


def override_diagnosis(db: Session, response: Response, body: OverrideIn) -> Diagnosis:
    """Teacher's reading becomes a new version; earlier versions and their evidence stay in history."""
    valid_ids = {m.id for m in response.question.misconceptions}
    if body.label == "misconception" and body.misconception_id not in valid_ids:
        raise InvalidInputError("Pick one of this question's misconceptions.")
    current = response.current_diagnosis
    kept_evidence = [
        Hypothesis(
            kind=h.kind,
            misconception_id=h.misconception_id,
            evidence_for=h.evidence_for,
            evidence_against=h.evidence_against,
            likelihood=h.likelihood,
            status="supported" if h.kind == body.label else "ruled_out",
        )
        for h in (current.hypotheses if current else [])
    ]
    diagnosis = Diagnosis(
        response=response,
        version=len(response.diagnoses) + 1,
        label=body.label,
        certainty=1.0,
        source="teacher",
        status="not_sure" if body.label == "not_sure" else "settled",
        misconception_id=body.misconception_id if body.label == "misconception" else None,
        note=body.note,
        hypotheses=kept_evidence,
    )
    db.add(diagnosis)
    db.flush()
    return diagnosis
