"""Teacher-facing views: same-score students split by likely reason, and one response in full."""
from collections import defaultdict

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ClassRoom, Diagnosis, Question, Response, Student
from app.schemas import (
    CorrectnessGroup,
    DiagnosisView,
    FollowUpView,
    HistoryEntry,
    HypothesisView,
    LabelGroup,
    QuestionResults,
    ResponseDetail,
    ResultsOut,
    StoryCount,
    StudentEntry,
    TraceView,
    WrongAnswerGroup,
)
from app.services.classrooms import question_out
from app.services.normalizer import normalize_answer

LABEL_ORDER = ["understood", "misread", "misconception", "guessed", "slip", "out_of_time", "not_sure"]


def _misconception_names(question: Question) -> dict[int, str]:
    return {m.id: m.label for m in question.misconceptions}


def _is_rule_only_because_ai_failed(d: Diagnosis) -> bool:
    return d.source == "rule" and any(run.step == "ai_analysis" for run in d.runs)


def _entry(r: Response, names: dict[int, str]) -> StudentEntry:
    d = r.current_diagnosis
    return StudentEntry(
        student_id=r.student_id,
        nickname=r.student.nickname,
        response_id=r.id,
        label=d.label,
        misconception_label=names.get(d.misconception_id) if d.misconception_id is not None else None,
        certainty=d.certainty,
        status=d.status,
        source=d.source,
    )


def _wrong_answer_groups(question: Question, responses: list[Response], names: dict[int, str]) -> list[WrongAnswerGroup]:
    """Group wrong answers by value ("0.2" and "1/5" are the same answer) and list the stories behind each."""
    groups: dict[str, list[Response]] = defaultdict(list)
    for r in responses:
        if not r.is_correct:
            groups[normalize_answer(r.answer_raw, question.answer_type)].append(r)
    out = []
    for same in sorted(groups.values(), key=len, reverse=True):
        entries = sorted((_entry(r, names) for r in same), key=lambda e: e.nickname.casefold())
        counts: dict[tuple[str, str | None], int] = defaultdict(int)
        for e in entries:
            counts[(e.label, e.misconception_label)] += 1
        stories = [
            StoryCount(label=label, misconception_label=mlabel, count=n)
            for (label, mlabel), n in sorted(counts.items(), key=lambda kv: (LABEL_ORDER.index(kv[0][0]), kv[0][1] or ""))
        ]
        decided = {(s.label, s.misconception_label) for s in stories if s.label != "not_sure"}
        out.append(
            WrongAnswerGroup(
                answer=same[0].answer_raw.strip(),
                count=len(same),
                several_stories=len(decided) > 1,
                stories=stories,
                students=entries,
            )
        )
    return out


def build_results(db: Session, cls: ClassRoom) -> ResultsOut:
    responses = db.scalars(select(Response).join(Student).where(Student.class_id == cls.id)).all()
    by_question: dict[int, list[Response]] = defaultdict(list)
    for r in responses:
        by_question[r.question_id].append(r)

    questions: list[QuestionResults] = []
    for question in cls.quiz.questions if cls.quiz else []:
        names = _misconception_names(question)
        groups: list[CorrectnessGroup] = []
        for is_correct in (True, False):
            entries = [_entry(r, names) for r in by_question[question.id] if r.is_correct == is_correct]
            if not entries:
                continue
            by_label: dict[str, list[StudentEntry]] = defaultdict(list)
            for e in entries:
                by_label[e.label].append(e)
            labels = [
                LabelGroup(label=label, count=len(by_label[label]),
                           students=sorted(by_label[label], key=lambda e: e.nickname.casefold()))
                for label in LABEL_ORDER
                if by_label[label]
            ]
            groups.append(CorrectnessGroup(is_correct=is_correct, count=len(entries), labels=labels))
        wrong_answers = _wrong_answer_groups(question, by_question[question.id], names)
        questions.append(
            QuestionResults(
                question_id=question.id,
                position=question.position,
                prompt=question.prompt,
                correct_answer=question.correct_answer,
                total_responses=len(by_question[question.id]),
                same_score_different_reasons=any(len(g.labels) > 1 for g in groups),
                same_wrong_answer_different_stories=any(w.several_stories for w in wrong_answers),
                groups=groups,
                wrong_answers=wrong_answers,
            )
        )

    total_students = db.scalar(select(func.count(Student.id)).where(Student.class_id == cls.id)) or 0
    rule_only = sum(1 for r in responses if _is_rule_only_because_ai_failed(r.current_diagnosis))
    return ResultsOut(class_id=cls.id, total_students=total_students, rule_only_count=rule_only, questions=questions)


def _diagnosis_view(d: Diagnosis, names: dict[int, str]) -> DiagnosisView:
    return DiagnosisView(
        diagnosis_id=d.id,
        version=d.version,
        label=d.label,
        misconception_id=d.misconception_id,
        misconception_label=names.get(d.misconception_id) if d.misconception_id is not None else None,
        certainty=d.certainty,
        source=d.source,
        status=d.status,
        note=d.note,
        created_at=d.created_at,
        hypotheses=[
            HypothesisView(
                kind=h.kind,
                misconception_id=h.misconception_id,
                misconception_label=names.get(h.misconception_id) if h.misconception_id is not None else None,
                evidence_for=h.evidence_for,
                evidence_against=h.evidence_against,
                likelihood=h.likelihood,
                status=h.status,
                would_confirm=h.would_confirm,
            )
            for h in d.hypotheses
        ],
    )


def response_detail(response: Response) -> ResponseDetail:
    names = _misconception_names(response.question)
    follow_up = next((d.follow_up for d in response.diagnoses if d.follow_up is not None), None)
    return ResponseDetail(
        response_id=response.id,
        student_id=response.student_id,
        nickname=response.student.nickname,
        question=question_out(response.question),
        answer=response.answer_raw,
        explanation=response.explanation_raw,
        self_confidence=response.self_confidence,
        is_correct=response.is_correct,
        time_spent_seconds=response.time_spent_seconds,
        timed_out=response.timed_out,
        ran_out_of_time=response.reported_out_of_time,
        created_at=response.created_at,
        diagnosis=_diagnosis_view(response.current_diagnosis, names),
        history=[
            HistoryEntry(version=d.version, label=d.label, source=d.source, certainty=d.certainty,
                         status=d.status, created_at=d.created_at)
            for d in reversed(response.diagnoses[:-1])
        ],
        follow_up=FollowUpView(
            question_text=follow_up.question_text,
            student_reply=follow_up.student_reply,
            answered_at=follow_up.answered_at,
        )
        if follow_up
        else None,
        trace=[
            TraceView(step=run.step, source=run.source, model=run.model, prompt_version=run.prompt_version,
                      latency_ms=run.latency_ms, ok=run.ok, detail=run.detail)
            for d in response.diagnoses
            for run in d.runs
        ],
    )
