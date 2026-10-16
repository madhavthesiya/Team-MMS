"""Runs the pipeline for stored responses and saves each reading as a new Diagnosis version.

Concurrency rules (teacher overrides vs AI re-reads):
- No database transaction is held open while the model is thinking.
- Every diagnosis write locks its response row (Postgres: SELECT ... FOR UPDATE), allocates the
  next version from the database, and relies on UNIQUE(response_id, version) as a backstop.
- The AI never writes on top of a teacher's reading: it re-checks at save time, after the call.
"""
from sqlalchemy import func, select, update
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

_WRITE_ATTEMPTS = 3


def _lock_response(db: Session, response_id: int) -> None:
    db.execute(select(Response.id).where(Response.id == response_id).with_for_update())


def _next_version(db: Session, response_id: int) -> int:
    return (db.scalar(select(func.max(Diagnosis.version)).where(Diagnosis.response_id == response_id)) or 0) + 1


def _latest(db: Session, response_id: int) -> Diagnosis | None:
    return db.scalar(
        select(Diagnosis).where(Diagnosis.response_id == response_id).order_by(Diagnosis.version.desc()).limit(1)
    )


def _work_from(response: Response, follow_up: FollowUp | None = None) -> StudentWork:
    return StudentWork(
        answer=response.answer_raw,
        explanation=response.explanation_raw,
        self_confidence=response.self_confidence,
        follow_up_question=follow_up.question_text if follow_up else None,
        follow_up_reply=follow_up.student_reply if follow_up else None,
        time_spent_seconds=response.time_spent_seconds,
        timed_out=response.timed_out,
        reported_out_of_time=response.reported_out_of_time,
    )


def store_outcome(db: Session, response: Response, outcome: DiagnosisOutcome) -> Diagnosis:
    """Add the outcome as the response's next version (flushes; caller commits)."""
    version = _next_version(db, response.id)
    hypotheses = [
        Hypothesis(
            kind=h.kind,
            misconception_id=h.misconception_id,
            evidence_for=h.evidence_for,
            evidence_against=h.evidence_against,
            likelihood=h.likelihood,
            status=h.status,
            would_confirm=h.would_confirm,
        )
        for h in outcome.hypotheses
    ]
    runs = [
        AIRun(
            step=s.step, source=s.source, model=s.model, prompt_version=s.prompt_version,
            latency_ms=s.latency_ms, ok=s.ok, detail=(s.detail or "")[:200],
        )
        for s in outcome.trace
    ]
    follow_up = (
        FollowUp(question_text=outcome.follow_up_question, discriminates=list(outcome.follow_up_discriminates))
        if outcome.follow_up_question
        else None
    )
    diagnosis = Diagnosis(
        response=response,
        version=version,
        label=outcome.label,
        certainty=outcome.certainty,
        source=outcome.source,
        status=outcome.status,
        misconception_id=outcome.misconception_id,
        hypotheses=hypotheses,
        runs=runs,
        follow_up=follow_up,
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

    work = StudentWork(
        answer=body.answer,
        explanation=redact_pii(body.explanation),
        self_confidence=body.self_confidence,
        time_spent_seconds=body.time_spent_seconds,
        timed_out=body.timed_out and question.time_limit_seconds is not None,  # no timer, no timeout
        reported_out_of_time=body.ran_out_of_time,
    )
    outcome = run_diagnosis(
        spec_from_question(question), work, ai, threshold=settings.certainty_threshold,
        allow_follow_up=True, budget_seconds=settings.ai_budget_seconds,
    )
    response = Response(
        student=student,
        question=question,
        answer_raw=work.answer,
        explanation_raw=work.explanation,
        self_confidence=work.self_confidence,
        is_correct=outcome.is_correct,  # decided by code in the pipeline, never by the AI
        time_spent_seconds=work.time_spent_seconds,
        timed_out=work.timed_out,
        reported_out_of_time=work.reported_out_of_time,
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
) -> Diagnosis | None:
    """Save the reply, re-read the answer with it, and store the new reading — unless a teacher
    has decided in the meantime. Returns the new diagnosis, or None if the teacher's stands."""
    follow_up = db.get(FollowUp, follow_up_id)
    if follow_up is None or follow_up.diagnosis.response.student_id != student.id:
        raise NotFoundError("Follow-up not found.")
    response_id = follow_up.diagnosis.response_id

    # Claim the follow-up atomically, so two simultaneous replies can't both be accepted.
    claimed = db.execute(
        update(FollowUp)
        .where(FollowUp.id == follow_up_id, FollowUp.student_reply.is_(None))
        .values(student_reply=redact_pii(reply), answered_at=utcnow())
    ).rowcount
    if not claimed:
        db.rollback()
        raise ConflictError("You already answered this follow-up.")
    db.commit()  # the reply is evidence: keep it whatever happens next
    db.refresh(follow_up)

    latest = _latest(db, response_id)
    if latest is not None and latest.source == "teacher":
        db.commit()
        return None  # teacher readings are final; the reply stays visible to the teacher
    response = db.get(Response, response_id)
    work = _work_from(response, follow_up)
    question = spec_from_question(response.question)
    db.commit()  # end the read transaction: nothing is held open while the model thinks

    # One follow-up only: if it is still unclear after the reply, it goes to the teacher as "not sure".
    outcome = run_diagnosis(
        question, work, ai, threshold=settings.certainty_threshold, allow_follow_up=False,
        budget_seconds=settings.ai_budget_seconds,
    )

    for _ in range(_WRITE_ATTEMPTS):
        _lock_response(db, response_id)
        latest = _latest(db, response_id)
        if latest is not None and latest.source == "teacher":
            db.commit()
            return None  # the teacher decided while the AI was thinking
        try:
            diagnosis = store_outcome(db, db.get(Response, response_id), outcome)
            db.commit()
            return diagnosis
        except IntegrityError:
            db.rollback()  # another writer took this version number; look again
    raise ConflictError("This answer is being updated right now — please try again.")


def override_diagnosis(db: Session, response: Response, body: OverrideIn) -> Diagnosis:
    """Teacher's reading becomes a new version; earlier versions and their evidence stay in history."""
    valid_ids = {m.id for m in response.question.misconceptions}
    if body.label == "misconception" and body.misconception_id not in valid_ids:
        raise InvalidInputError("Pick one of this question's misconceptions.")

    for _ in range(_WRITE_ATTEMPTS):
        _lock_response(db, response.id)
        current = _latest(db, response.id)
        kept_evidence = [
            Hypothesis(
                kind=h.kind,
                misconception_id=h.misconception_id,
                evidence_for=h.evidence_for,
                evidence_against=h.evidence_against,
                likelihood=h.likelihood,
                status="supported" if h.kind == body.label else "ruled_out",
                would_confirm=h.would_confirm,
            )
            for h in (current.hypotheses if current else [])
        ]
        diagnosis = Diagnosis(
            response=response,
            version=_next_version(db, response.id),
            label=body.label,
            certainty=1.0,
            source="teacher",
            status="not_sure" if body.label == "not_sure" else "settled",
            misconception_id=body.misconception_id if body.label == "misconception" else None,
            note=body.note,
            hypotheses=kept_evidence,
        )
        db.add(diagnosis)
        try:
            db.flush()
            db.commit()
            return diagnosis
        except IntegrityError:
            db.rollback()  # an AI reading took this version number at the same moment; retry on top
    raise ConflictError("This answer is being updated right now — please try again.")
