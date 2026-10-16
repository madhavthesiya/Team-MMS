"""Riddle 4 — Better Marks, Better Understanding?

A better score after a next step might mean the idea became clear, the pattern became familiar,
or the learner got used to the tool. We only count something as learned when it survives:

- a changed situation: a teacher-written transfer item, never the same item twice for a student;
- without the tool: no follow-up question, no hints — the pipeline runs with follow-ups disabled;
- after time: the gap since the original answer reaches RECHECK_LASTING_DAYS for "lasted";
- with reasoning: a right answer whose explanation shows the key idea (rules + AI agree), not just a mark.

When it doesn't travel, the story behind the new miss decides what to change, and the teacher can
schedule another re-check in yet another situation. The original response is never edited.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.ai.client import AIClient
from app.config import Settings
from app.domain import MisconceptionSpec, QuestionSpec, StudentWork
from app.models import ClassRoom, Question, Recheck, Response, Student, TransferItem, utcnow
from app.schemas import (
    RecheckAnswerIn,
    RecheckHypothesis,
    RecheckView,
    ScheduledRecheck,
    ScheduleRechecksIn,
    ScheduleRechecksOut,
    SkippedStudent,
    StudentRecheckOut,
    TransferItemIn,
    TransferItemOut,
    TransferQuestionReport,
    TransferReport,
)
from app.services.errors import ConflictError, InvalidInputError, NotFoundError
from app.services.normalizer import normalize_text
from app.services.pipeline import DiagnosisOutcome, run_diagnosis
from app.services.redact import redact_pii

STORY_NEXT_STEP = {
    "misread": "Practise spotting the condition the question asks for (underline it) before answering.",
    "out_of_time": "Try the same idea again without a time limit.",
    "slip": "Use a check-your-working routine on two similar items.",
    "guessed": "Talk it through one-on-one, then try one worked example together.",
    "not_sure": "Talk it through one-on-one to find out what they were thinking.",
    "understood": "No reteach needed: check that it holds in a new situation.",
}


def _aware(dt: datetime) -> datetime:
    """SQLite returns naive datetimes even for timezone columns; treat stored values as UTC."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _class_question(db: Session, cls: ClassRoom, question_id: int) -> Question:
    question = db.get(Question, question_id)
    if question is None or question.quiz.class_id != cls.id:
        raise NotFoundError("Question not found in this class.")
    return question


def transfer_item_out(item: TransferItem) -> TransferItemOut:
    return TransferItemOut(
        transfer_item_id=item.id, prompt=item.prompt, correct_answer=item.correct_answer,
        answer_type=item.answer_type, choices=list(item.choices), change=item.change,
    )


def add_transfer_item(db: Session, cls: ClassRoom, question_id: int, body: TransferItemIn) -> TransferItem:
    """Allowed after students have answered (unlike editing the quiz): it adds a new situation, it
    doesn't change any evidence already collected."""
    question = _class_question(db, cls, question_id)
    if normalize_text(body.prompt) == normalize_text(question.prompt):
        raise InvalidInputError("A re-check item must change the situation, not repeat the question.")
    item = TransferItem(
        question=question, prompt=body.prompt, correct_answer=body.correct_answer,
        answer_type=body.answer_type, choices=list(body.choices), change=body.change,
    )
    db.add(item)
    db.flush()
    return item


def default_next_step(question: Question, response: Response) -> str:
    current = response.current_diagnosis
    label = current.label if current else "not_sure"
    if label == "misconception":
        m = next((m for m in question.misconceptions if m.id == current.misconception_id), None)
        if m and m.remedy_hint:
            return m.remedy_hint
        return f"Reteach the key idea: {question.key_idea}"
    return STORY_NEXT_STEP.get(label, STORY_NEXT_STEP["not_sure"])


def _pick_item(question: Question, student: Student) -> TransferItem | None:
    """A situation this student has never seen, preferring a kind of change they haven't met yet."""
    mine = [rc for rc in student.rechecks if rc.question_id == question.id]
    used_ids = {rc.transfer_item_id for rc in mine}
    used_changes = {normalize_text(rc.transfer_item.change) for rc in mine}
    fresh = [i for i in question.transfer_items if i.id not in used_ids]
    fresh.sort(key=lambda i: normalize_text(i.change) in used_changes)
    return fresh[0] if fresh else None


def schedule_rechecks(
    db: Session, cls: ClassRoom, body: ScheduleRechecksIn, now: datetime | None = None
) -> ScheduleRechecksOut:
    now = now or utcnow()
    question = _class_question(db, cls, body.question_id)
    if not question.transfer_items:
        raise ConflictError("Add at least one re-check item (the same idea in a new situation) first.")

    students = {s.id: s for s in cls.students}
    wanted = body.student_ids if body.student_ids is not None else list(students)
    answered = {
        r.student_id: r
        for r in db.scalars(select(Response).where(Response.question_id == question.id)).all()
    }
    scheduled: list[ScheduledRecheck] = []
    skipped: list[SkippedStudent] = []
    for sid in wanted:
        student = students.get(sid)
        if student is None:
            skipped.append(SkippedStudent(student_id=sid, nickname="", reason="not in this class"))
            continue
        response = answered.get(sid)
        if response is None:
            if body.student_ids is not None:
                skipped.append(SkippedStudent(student_id=sid, nickname=student.nickname,
                                              reason="hasn't answered the original question yet"))
            continue
        if any(rc.question_id == question.id and rc.answered_at is None for rc in student.rechecks):
            skipped.append(SkippedStudent(student_id=sid, nickname=student.nickname,
                                          reason="already has a re-check waiting for this question"))
            continue
        item = _pick_item(question, student)
        if item is None:
            skipped.append(SkippedStudent(student_id=sid, nickname=student.nickname,
                                          reason="no unused re-check item left: add another situation"))
            continue
        recheck = Recheck(
            student=student,
            question=question,
            transfer_item=item,
            next_step=body.next_step or default_next_step(question, response),
            created_at=now,
            available_at=now + timedelta(days=body.delay_days),
        )
        db.add(recheck)
        db.flush()
        scheduled.append(ScheduledRecheck(
            recheck_id=recheck.id, student_id=sid, nickname=student.nickname, transfer_item_id=item.id,
            change=item.change, available_at=recheck.available_at, next_step=recheck.next_step,
        ))
    return ScheduleRechecksOut(scheduled=scheduled, skipped=skipped)


def judge(outcome: DiagnosisOutcome, gap_days: float, lasting_days: float) -> str:
    """What the re-check shows. A right answer alone is a better mark, not proof of understanding."""
    if not outcome.is_correct:
        return "did_not_travel"
    shows_key_idea = outcome.label == "understood" and outcome.status == "settled" and outcome.source in ("ai", "both")
    if not shows_key_idea:
        return "unconvincing"
    return "lasting" if gap_days >= lasting_days else "travelled"


def change_plan(verdict: str, outcome: DiagnosisOutcome, question: Question, previous_step: str,
                gap_days: float, lasting_days: float) -> str:
    """What to do next, from the verdict and — when it didn't travel — the story behind the new miss."""
    if verdict == "lasting":
        return f"It travelled to a new situation and held after {gap_days:.0f} days without the tool. No change needed."
    if verdict == "travelled":
        when = "on the same day as" if gap_days < 1 else f"only {gap_days:.0f} days after"
        return (f"It travelled to a new situation without the tool, but {when} the first answer. "
                f"Check again once {lasting_days:.0f} days have passed to see if it lasts.")
    if verdict == "unconvincing":
        if not outcome.ai_available:
            return ("Right answer, but the explanation couldn't be checked (AI unavailable). "
                    "Read it before counting this as learned.")
        return ("Right answer, but the explanation doesn't show the key idea, so it may be a familiar pattern. "
                "Re-check in a less familiar situation and ask them to explain.")

    story = outcome.label
    if story == "not_sure" and outcome.hypotheses:
        story = max(outcome.hypotheses, key=lambda h: h.likelihood).kind
    step = f" The last step (\"{previous_step}\") didn't carry over." if previous_step else ""
    if story == "misconception":
        names = {m.id: m for m in question.misconceptions}
        top = next((h for h in outcome.hypotheses if h.kind == "misconception" and h.misconception_id in names), None)
        m = names.get(outcome.misconception_id) or (names.get(top.misconception_id) if top else None)
        rule = f" ({m.label})" if m else ""
        alt = f" e.g. {m.remedy_hint}" if m and m.remedy_hint else ""
        return (f"The mistaken rule{rule} came back in a new situation.{step} Change the approach: teach it with a "
                f"different representation or a counterexample{alt}, then re-check with another situation.")
    if story == "misread":
        return (f"They missed a condition again in a new wording.{step} Practise spotting what the question asks, "
                "then re-check with a differently worded item.")
    if story == "slip":
        return "The method may be right and a slip changed the answer. Re-check with another item before reteaching."
    if story == "out_of_time":
        return "They ran out of time. Re-check untimed before changing the teaching."
    if story == "guessed":
        return f"No reasoning to build on.{step} Talk it through one-on-one, then re-check."
    return ("It didn't travel and the reason isn't clear yet. Read their explanation and talk it through "
            "before choosing a new step.")


def answer_recheck(
    db: Session, student: Student, recheck_id: int, body: RecheckAnswerIn, ai: AIClient, settings: Settings,
    now: datetime | None = None,
) -> Recheck:
    recheck = db.get(Recheck, recheck_id)
    if recheck is None or recheck.student_id != student.id:
        raise NotFoundError("Check-in not found.")
    if recheck.answered_at is not None:
        raise ConflictError("You already answered this check-in.")
    now = now or utcnow()
    if _aware(recheck.available_at) > now:
        raise ConflictError("This check-in isn't open yet.")

    item, question = recheck.transfer_item, recheck.question
    spec = QuestionSpec(
        prompt=item.prompt,
        correct_answer=item.correct_answer,
        answer_type=item.answer_type,
        key_idea=question.key_idea,
        # Trigger answers belong to the original numbers, so only the descriptions carry over.
        misconceptions=tuple(
            MisconceptionSpec(id=m.id, label=m.label, trigger_answers=(), signal_text=m.signal_text,
                              remedy_hint=m.remedy_hint)
            for m in question.misconceptions
        ),
    )
    work = StudentWork(answer=body.answer, explanation=redact_pii(body.explanation), self_confidence=body.self_confidence,
                       time_spent_seconds=body.time_spent_seconds)
    original = db.scalar(select(Response).where(Response.student_id == student.id, Response.question_id == question.id))
    gap_days = (now - _aware(original.created_at)).total_seconds() / 86400 if original else 0.0
    previous_step = recheck.next_step
    db.commit()  # nothing is held open while the model thinks

    # The tool is taken away: no follow-up question, no hints. Correctness is still decided by code.
    outcome = run_diagnosis(spec, work, ai, threshold=settings.certainty_threshold, allow_follow_up=False,
                            budget_seconds=settings.ai_budget_seconds)
    verdict = judge(outcome, gap_days, settings.recheck_lasting_days)
    names = {m.id: m.label for m in question.misconceptions}
    values = dict(
        answered_at=now,
        answer_raw=body.answer,
        explanation_raw=work.explanation,
        self_confidence=body.self_confidence,
        time_spent_seconds=body.time_spent_seconds,
        is_correct=outcome.is_correct,
        reading_label=outcome.label,
        reading_source=outcome.source,
        reading_misconception_id=outcome.misconception_id,
        hypotheses=[
            {"kind": h.kind, "misconception_label": names.get(h.misconception_id), "evidence_for": h.evidence_for,
             "evidence_against": h.evidence_against, "likelihood": h.likelihood, "status": h.status,
             "would_confirm": h.would_confirm}
            for h in outcome.hypotheses
        ],
        trace=[{"step": s.step, "source": s.source, "ok": s.ok, "detail": s.detail} for s in outcome.trace],
        gap_days=round(gap_days, 2),
        verdict=verdict,
        change_plan=change_plan(verdict, outcome, question, previous_step, gap_days, settings.recheck_lasting_days),
    )
    # Write once: a double submit (two tabs) can't record two attempts.
    claimed = db.execute(
        update(Recheck).where(Recheck.id == recheck_id, Recheck.answered_at.is_(None)).values(**values)
    ).rowcount
    if not claimed:
        db.rollback()
        raise ConflictError("You already answered this check-in.")
    db.commit()
    db.refresh(recheck)
    return recheck


def student_rechecks(student: Student, now: datetime | None = None) -> list[StudentRecheckOut]:
    now = now or utcnow()
    open_now = [rc for rc in student.rechecks if rc.answered_at is None and _aware(rc.available_at) <= now]
    return [
        StudentRecheckOut(recheck_id=rc.id, prompt=rc.transfer_item.prompt, answer_type=rc.transfer_item.answer_type,
                          choices=list(rc.transfer_item.choices))
        for rc in sorted(open_now, key=lambda rc: rc.available_at)
    ]


def recheck_view(recheck: Recheck) -> RecheckView:
    names = {m.id: m.label for m in recheck.question.misconceptions}
    original = next((r for r in recheck.student.responses if r.question_id == recheck.question_id), None)
    original_reading = original.current_diagnosis if original else None
    return RecheckView(
        recheck_id=recheck.id,
        student_id=recheck.student_id,
        nickname=recheck.student.nickname,
        question_id=recheck.question_id,
        transfer_item=transfer_item_out(recheck.transfer_item),
        next_step=recheck.next_step,
        created_at=recheck.created_at,
        available_at=recheck.available_at,
        answered_at=recheck.answered_at,
        answer=recheck.answer_raw,
        explanation=recheck.explanation_raw,
        self_confidence=recheck.self_confidence,
        time_spent_seconds=recheck.time_spent_seconds,
        is_correct=recheck.is_correct,
        reading_label=recheck.reading_label,
        reading_source=recheck.reading_source,
        misconception_label=names.get(recheck.reading_misconception_id),
        hypotheses=[RecheckHypothesis(**h) for h in recheck.hypotheses or []],
        gap_days=recheck.gap_days,
        verdict=recheck.verdict,
        change_plan=recheck.change_plan,
        original_correct=original.is_correct if original else None,
        original_label=original_reading.label if original_reading else None,
    )


def rechecks_for(student: Student, question_id: int) -> list[RecheckView]:
    return [recheck_view(rc) for rc in sorted(student.rechecks, key=lambda rc: rc.created_at) if rc.question_id == question_id]


def transfer_report(db: Session, cls: ClassRoom, settings: Settings, now: datetime | None = None) -> TransferReport:
    now = now or utcnow()
    student_ids = [s.id for s in cls.students]
    rechecks = (
        db.scalars(select(Recheck).where(Recheck.student_id.in_(student_ids))).all() if student_ids else []
    )
    questions = []
    for question in cls.quiz.questions if cls.quiz else []:
        mine = sorted((rc for rc in rechecks if rc.question_id == question.id), key=lambda rc: rc.created_at)
        answered = [rc for rc in mine if rc.answered_at is not None]
        verdicts = {v: 0 for v in ("pending", "lasting", "travelled", "unconvincing", "did_not_travel")}
        for rc in mine:
            verdicts[rc.verdict] = verdicts.get(rc.verdict, 0) + 1
        questions.append(TransferQuestionReport(
            question_id=question.id,
            position=question.position,
            prompt=question.prompt,
            transfer_item_count=len(question.transfer_items),
            scheduled=len(mine),
            waiting=sum(1 for rc in mine if rc.answered_at is None and _aware(rc.available_at) > now),
            answered=len(answered),
            better_marks=sum(1 for rc in answered if rc.is_correct),
            better_understanding=sum(1 for rc in answered if rc.verdict in ("travelled", "lasting")),
            verdicts=verdicts,
            rechecks=[recheck_view(rc) for rc in mine],
        ))
    return TransferReport(class_id=cls.id, lasting_days=settings.recheck_lasting_days, questions=questions)
