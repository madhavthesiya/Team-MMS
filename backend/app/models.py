"""Database tables.

Evidence (Response) is written once and never edited. Interpretation (Diagnosis) is versioned:
every re-read — after a follow-up reply or a teacher override — adds a new version, and the
current reading is the highest version. Nothing is deleted except when a teacher deletes a class.
"""
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, foreign, mapped_column, relationship

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    """Real user account for a teacher or student."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    role: Mapped[str] = mapped_column(String(20))  # "teacher" or "student"
    email: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(80))
    password_hash: Mapped[str] = mapped_column(String(128))
    auth_token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    classes: Mapped[list["ClassRoom"]] = relationship("ClassRoom", back_populates="teacher_user", primaryjoin="User.id == foreign(ClassRoom.teacher_user_id)")
    students: Mapped[list["Student"]] = relationship("Student", back_populates="user", primaryjoin="User.id == foreign(Student.user_id)")


class ClassRoom(Base):
    __tablename__ = "classes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    join_code: Mapped[str] = mapped_column(String(6), unique=True, index=True)
    teacher_token_hash: Mapped[str] = mapped_column(String(64))
    teacher_user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    teacher_user: Mapped["User | None"] = relationship(
        "User", back_populates="classes", primaryjoin="foreign(ClassRoom.teacher_user_id) == User.id"
    )
    quiz: Mapped["Quiz | None"] = relationship(
        back_populates="classroom", cascade="all, delete-orphan", uselist=False
    )
    students: Mapped[list["Student"]] = relationship(back_populates="classroom", cascade="all, delete-orphan")


class Quiz(Base):
    __tablename__ = "quizzes"

    id: Mapped[int] = mapped_column(primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), unique=True)
    topic: Mapped[str] = mapped_column(String(80))
    title: Mapped[str] = mapped_column(String(120))

    classroom: Mapped[ClassRoom] = relationship(back_populates="quiz")
    questions: Mapped[list["Question"]] = relationship(
        back_populates="quiz", cascade="all, delete-orphan", order_by="Question.position"
    )


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    quiz_id: Mapped[int] = mapped_column(ForeignKey("quizzes.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer)
    prompt: Mapped[str] = mapped_column(Text)
    correct_answer: Mapped[str] = mapped_column(String(100))
    answer_type: Mapped[str] = mapped_column(String(10))
    key_idea: Mapped[str] = mapped_column(Text)
    choices: Mapped[list[str]] = mapped_column(JSON, default=list)
    time_limit_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    quiz: Mapped[Quiz] = relationship(back_populates="questions")
    transfer_items: Mapped[list["TransferItem"]] = relationship(
        back_populates="question", cascade="all, delete-orphan", order_by="TransferItem.id"
    )
    misconceptions: Mapped[list["Misconception"]] = relationship(
        back_populates="question", cascade="all, delete-orphan", order_by="Misconception.id"
    )


class Misconception(Base):
    """A known wrong idea, entered by the teacher. Never hard-coded."""

    __tablename__ = "misconceptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(String(80))
    trigger_answers: Mapped[list[str]] = mapped_column(JSON, default=list)
    signal_text: Mapped[str] = mapped_column(Text, default="")
    remedy_hint: Mapped[str] = mapped_column(Text, default="")

    question: Mapped[Question] = relationship(back_populates="misconceptions")


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"))
    nickname: Mapped[str] = mapped_column(String(30))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User | None"] = relationship(
        "User", back_populates="students", primaryjoin="foreign(Student.user_id) == User.id"
    )
    classroom: Mapped[ClassRoom] = relationship(back_populates="students")
    responses: Mapped[list["Response"]] = relationship(back_populates="student", cascade="all, delete-orphan")
    rechecks: Mapped[list["Recheck"]] = relationship(back_populates="student", cascade="all, delete-orphan")


class Response(Base):
    """What the student did. Immutable evidence."""

    __tablename__ = "responses"
    __table_args__ = (UniqueConstraint("student_id", "question_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"))
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"))
    answer_raw: Mapped[str] = mapped_column(String(100))
    explanation_raw: Mapped[str] = mapped_column(Text)
    self_confidence: Mapped[str] = mapped_column(String(10))
    is_correct: Mapped[bool] = mapped_column(Boolean)
    time_spent_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    timed_out: Mapped[bool] = mapped_column(Boolean, default=False)
    reported_out_of_time: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    student: Mapped[Student] = relationship(back_populates="responses")
    question: Mapped[Question] = relationship()
    diagnoses: Mapped[list["Diagnosis"]] = relationship(
        back_populates="response", cascade="all, delete-orphan", order_by="Diagnosis.version"
    )

    @property
    def current_diagnosis(self) -> "Diagnosis | None":
        return self.diagnoses[-1] if self.diagnoses else None


class Diagnosis(Base):
    """What we think the evidence means. A hypothesis, versioned, never a verdict."""

    __tablename__ = "diagnoses"
    # Two writers (teacher override, AI re-read) can't both claim the same version.
    __table_args__ = (UniqueConstraint("response_id", "version"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    response_id: Mapped[int] = mapped_column(ForeignKey("responses.id", ondelete="CASCADE"))
    version: Mapped[int] = mapped_column(Integer)
    label: Mapped[str] = mapped_column(String(20))
    certainty: Mapped[float] = mapped_column(Float, default=0.0)
    source: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(10))
    misconception_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    response: Mapped[Response] = relationship(back_populates="diagnoses")
    hypotheses: Mapped[list["Hypothesis"]] = relationship(
        back_populates="diagnosis", cascade="all, delete-orphan", order_by="Hypothesis.id"
    )
    follow_up: Mapped["FollowUp | None"] = relationship(
        back_populates="diagnosis", cascade="all, delete-orphan", uselist=False
    )
    runs: Mapped[list["AIRun"]] = relationship(
        back_populates="diagnosis", cascade="all, delete-orphan", order_by="AIRun.id"
    )


class Hypothesis(Base):
    """One competing explanation, with the student's own words as evidence."""

    __tablename__ = "hypotheses"

    id: Mapped[int] = mapped_column(primary_key=True)
    diagnosis_id: Mapped[int] = mapped_column(ForeignKey("diagnoses.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(20))
    misconception_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    evidence_for: Mapped[str] = mapped_column(Text)
    evidence_against: Mapped[str] = mapped_column(Text, default="")
    likelihood: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(12), default="open")
    would_confirm: Mapped[str] = mapped_column(Text, default="")

    diagnosis: Mapped[Diagnosis] = relationship(back_populates="hypotheses")


class FollowUp(Base):
    """A targeted question asked because the first reading was unclear."""

    __tablename__ = "follow_ups"

    id: Mapped[int] = mapped_column(primary_key=True)
    diagnosis_id: Mapped[int] = mapped_column(ForeignKey("diagnoses.id", ondelete="CASCADE"), unique=True)
    question_text: Mapped[str] = mapped_column(Text)
    discriminates: Mapped[list[str]] = mapped_column(JSON, default=list)
    rationale: Mapped[str] = mapped_column(Text, default="")
    expected_evidence: Mapped[list[dict]] = mapped_column(JSON, default=list)
    declined_reason: Mapped[str] = mapped_column(String(24), default="")
    student_reply: Mapped[str | None] = mapped_column(Text, nullable=True)
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    diagnosis: Mapped[Diagnosis] = relationship(back_populates="follow_up")


class AIRun(Base):
    """One step of the diagnosis workflow — shown to the teacher under "Why this label?"."""

    __tablename__ = "ai_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    diagnosis_id: Mapped[int] = mapped_column(ForeignKey("diagnoses.id", ondelete="CASCADE"))
    step: Mapped[str] = mapped_column(String(30))
    source: Mapped[str] = mapped_column(String(10))
    model: Mapped[str | None] = mapped_column(String(60), nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(String(30), nullable=True)
    latency_ms: Mapped[int] = mapped_column(Integer)
    ok: Mapped[bool] = mapped_column(Boolean)
    detail: Mapped[str | None] = mapped_column(String(200), nullable=True)

    diagnosis: Mapped[Diagnosis] = relationship(back_populates="runs")


class TransferItem(Base):
    """The same key idea in a changed situation (new numbers, a story, the reverse question...).
    Written by the teacher; used for re-checks so a better mark can't come from a familiar item."""

    __tablename__ = "transfer_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"))
    prompt: Mapped[str] = mapped_column(Text)
    correct_answer: Mapped[str] = mapped_column(String(100))
    answer_type: Mapped[str] = mapped_column(String(10))
    choices: Mapped[list[str]] = mapped_column(JSON, default=list)
    change: Mapped[str] = mapped_column(String(80))  # what is different from the original, in the teacher's words

    question: Mapped[Question] = relationship(back_populates="transfer_items")


class Recheck(Base):
    """A later, unaided attempt at a transfer item: did the understanding travel and last?

    Written once (immutable evidence, like Response). The original response is never changed;
    the verdict describes this attempt, and "didn't travel" leads to a changed next step."""

    __tablename__ = "rechecks"
    __table_args__ = (UniqueConstraint("student_id", "transfer_item_id"),)  # never the same item twice

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"))
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"))
    transfer_item_id: Mapped[int] = mapped_column(ForeignKey("transfer_items.id", ondelete="CASCADE"))
    next_step: Mapped[str] = mapped_column(Text, default="")  # what was offered before this re-check
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    answer_raw: Mapped[str | None] = mapped_column(String(100), nullable=True)
    explanation_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    self_confidence: Mapped[str | None] = mapped_column(String(10), nullable=True)
    time_spent_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    reading_label: Mapped[str | None] = mapped_column(String(20), nullable=True)
    reading_source: Mapped[str | None] = mapped_column(String(10), nullable=True)
    reading_misconception_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hypotheses: Mapped[list[dict]] = mapped_column(JSON, default=list)
    trace: Mapped[list[dict]] = mapped_column(JSON, default=list)
    gap_days: Mapped[float | None] = mapped_column(Float, nullable=True)  # since the original answer
    verdict: Mapped[str] = mapped_column(String(20), default="pending")
    change_plan: Mapped[str] = mapped_column(Text, default="")

    student: Mapped[Student] = relationship(back_populates="rechecks")
    question: Mapped[Question] = relationship()
    transfer_item: Mapped[TransferItem] = relationship()
