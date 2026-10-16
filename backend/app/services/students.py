from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ClassRoom, Student
from app.schemas import StudentOut, StudentQuestionOut, StudentQuizOut
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
    )
