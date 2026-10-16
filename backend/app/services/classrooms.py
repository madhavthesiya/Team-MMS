from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ClassRoom, Misconception, Question, Quiz, Response, Student
from app.schemas import ClassOut, MisconceptionOut, QuestionOut, QuizIn, QuizOut
from app.security import hash_token, new_join_code, new_token
from app.services.errors import ConflictError


def create_classroom(db: Session, name: str, *, is_sample: bool = False) -> tuple[ClassRoom, str]:
    """Create a class. Returns (class, raw teacher token); only the token's hash is stored."""
    for _ in range(10):
        code = new_join_code()
        if db.scalar(select(ClassRoom.id).where(ClassRoom.join_code == code)) is None:
            break
    else:
        raise ConflictError("Could not allocate a join code, please retry.")
    token = new_token()
    cls = ClassRoom(name=name, join_code=code, teacher_token_hash=hash_token(token), is_sample=is_sample)
    db.add(cls)
    db.flush()
    return cls, token


def has_responses(db: Session, cls: ClassRoom) -> bool:
    count = db.scalar(select(func.count(Response.id)).join(Student).where(Student.class_id == cls.id))
    return bool(count)


def replace_quiz(db: Session, cls: ClassRoom, body: QuizIn) -> Quiz:
    """Replace the class quiz. Locked once any student has answered, so evidence always matches its question."""
    if has_responses(db, cls):
        raise ConflictError("Students have already answered — this quiz is locked.")
    if cls.quiz is not None:
        db.delete(cls.quiz)
        db.flush()
        db.expire(cls, ["quiz"])
    quiz = Quiz(class_id=cls.id, topic=body.topic, title=body.title)
    for position, q in enumerate(body.questions, start=1):
        question = Question(
            position=position,
            prompt=q.prompt,
            correct_answer=q.correct_answer,
            answer_type=q.answer_type,
            key_idea=q.key_idea,
            choices=list(q.choices),
            time_limit_seconds=q.time_limit_seconds,
        )
        question.misconceptions = [
            Misconception(
                label=m.label,
                trigger_answers=list(m.trigger_answers),
                signal_text=m.signal_text,
                remedy_hint=m.remedy_hint,
            )
            for m in q.misconceptions
        ]
        quiz.questions.append(question)
    db.add(quiz)
    db.flush()
    return quiz


def question_out(q: Question) -> QuestionOut:
    return QuestionOut(
        question_id=q.id,
        position=q.position,
        prompt=q.prompt,
        correct_answer=q.correct_answer,
        answer_type=q.answer_type,
        key_idea=q.key_idea,
        choices=list(q.choices),
        misconceptions=[
            MisconceptionOut(
                misconception_id=m.id,
                label=m.label,
                trigger_answers=list(m.trigger_answers),
                signal_text=m.signal_text,
                remedy_hint=m.remedy_hint,
            )
            for m in q.misconceptions
        ],
        time_limit_seconds=q.time_limit_seconds,
    )


def quiz_out(quiz: Quiz) -> QuizOut:
    return QuizOut(quiz_id=quiz.id, topic=quiz.topic, title=quiz.title, questions=[question_out(q) for q in quiz.questions])


def class_out(cls: ClassRoom) -> ClassOut:
    return ClassOut(
        class_id=cls.id,
        name=cls.name,
        join_code=cls.join_code,
        is_sample=cls.is_sample,
        created_at=cls.created_at,
        quiz=quiz_out(cls.quiz) if cls.quiz else None,
    )
