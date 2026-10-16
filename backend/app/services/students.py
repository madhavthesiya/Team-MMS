from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ClassRoom, Student
from app.schemas import PendingFollowUpOut, StudentOut, StudentQuestionOut, StudentQuizOut
from app.security import hash_token, new_token
from app.services.errors import NotFoundError


def join_class(db: Session, join_code: str, nickname: str) -> tuple[Student, str]:
    """Add a student by nickname only. Returns (student, raw student token)."""
    cls = db.scalar(select(ClassRoom).where(ClassRoom.join_code == join_code))
    if cls is None:
        raise NotFoundError("No class with that code.")
    token = new_token()
    student = Student(class_id=cls.id, nickname=nickname, token_hash=hash_token(token))
    db.add(student)
    db.flush()
    return student, token


def student_out(student: Student) -> StudentOut:
    """The student's view of the quiz: never includes answers, key ideas or misconceptions."""
    quiz = student.classroom.quiz
    student_quiz = (
        StudentQuizOut(
            topic=quiz.topic,
            title=quiz.title,
            questions=[
                StudentQuestionOut(
                    question_id=q.id, position=q.position, prompt=q.prompt,
                    answer_type=q.answer_type, choices=list(q.choices),
                    time_limit_seconds=q.time_limit_seconds,
                )
                for q in quiz.questions
            ],
        )
        if quiz
        else None
    )
    return StudentOut(
        student_id=student.id,
        nickname=student.nickname,
        class_name=student.classroom.name,
        quiz=student_quiz,
        answered_question_ids=sorted(r.question_id for r in student.responses),
        pending_follow_ups=pending_follow_ups(student),
    )


def pending_follow_ups(student: Student) -> list[PendingFollowUpOut]:
    """Follow-ups still waiting on this student — unanswered, or answered but never processed —
    so a refresh, timeout or failed save doesn't strand them. Only the current reading counts:
    once a teacher has reviewed an answer (a newer version exists), its follow-up is closed."""
    pending = []
    for r in sorted(student.responses, key=lambda r: r.question.position):
        current = r.current_diagnosis
        if current and current.status == "open" and current.follow_up:
            pending.append(
                PendingFollowUpOut(
                    follow_up_id=current.follow_up.id,
                    question_id=r.question_id,
                    question_text=current.follow_up.question_text,
                    reply_saved=current.follow_up.student_reply is not None,
                )
            )
    return pending
