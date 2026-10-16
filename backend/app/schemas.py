"""Request/response models for the HTTP API. Mirrors docs/api-contract.md."""
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, model_validator

from app.domain import AnswerType, Confidence, HypothesisKind, HypStatus, Label, Source, Status
from app.services.normalizer import answers_match


Str30 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]
Str80 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
Str100 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Str120 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Str1000 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]
OptStr500 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]
OptStr2000 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]
JoinCode = Annotated[str, StringConstraints(strip_whitespace=True, to_upper=True, min_length=6, max_length=6)]


# ---------- classes and quizzes ----------

class ClassCreate(BaseModel):
    name: Str80


class ClassCreated(BaseModel):
    class_id: int
    name: str
    join_code: str
    teacher_token: str


class MisconceptionIn(BaseModel):
    label: Str80
    trigger_answers: list[Str100] = Field(default_factory=list, max_length=10)
    signal_text: OptStr500 = ""
    remedy_hint: OptStr500 = ""


class QuestionIn(BaseModel):
    prompt: Str1000
    correct_answer: Str100
    answer_type: AnswerType
    key_idea: Str1000
    choices: list[Str100] = Field(default_factory=list, max_length=6)
    misconceptions: list[MisconceptionIn] = Field(default_factory=list, max_length=6)
    time_limit_seconds: int | None = Field(default=None, ge=10, le=3600)

    @model_validator(mode="after")
    def _consistent(self) -> "QuestionIn":
        if self.answer_type == "choice":
            if len(self.choices) < 2:
                raise ValueError("choice questions need at least 2 choices")
            if not any(answers_match(self.correct_answer, c, "choice") for c in self.choices):
                raise ValueError("correct_answer must be one of the choices")
        for m in self.misconceptions:
            for trigger in m.trigger_answers:
                if answers_match(trigger, self.correct_answer, self.answer_type):
                    raise ValueError(f"trigger answer '{trigger}' is the correct answer")
        return self


class QuizIn(BaseModel):
    topic: Str80
    title: Str120
    questions: list[QuestionIn] = Field(min_length=1, max_length=20)


class MisconceptionOut(BaseModel):
    misconception_id: int
    label: str
    trigger_answers: list[str]
    signal_text: str
    remedy_hint: str


class QuestionOut(BaseModel):
    question_id: int
    position: int
    prompt: str
    correct_answer: str
    answer_type: AnswerType
    key_idea: str
    choices: list[str]
    misconceptions: list[MisconceptionOut]
    time_limit_seconds: int | None


class QuizOut(BaseModel):
    quiz_id: int
    topic: str
    title: str
    questions: list[QuestionOut]


class ClassOut(BaseModel):
    class_id: int
    name: str
    join_code: str
    is_sample: bool
    created_at: datetime
    quiz: QuizOut | None


# ---------- students ----------

class JoinIn(BaseModel):
    join_code: JoinCode
    nickname: Str30


class StudentQuestionOut(BaseModel):
    question_id: int
    position: int
    prompt: str
    answer_type: AnswerType
    choices: list[str]
    time_limit_seconds: int | None


class StudentQuizOut(BaseModel):
    topic: str
    title: str
    questions: list[StudentQuestionOut]


class PendingFollowUpOut(BaseModel):
    follow_up_id: int
    question_id: int
    question_text: str
    reply_saved: bool  # True: the reply is in, processing didn't finish → call .../resume


class StudentOut(BaseModel):
    student_id: int
    nickname: str
    class_name: str
    quiz: StudentQuizOut | None
    answered_question_ids: list[int]
    pending_follow_ups: list[PendingFollowUpOut]


class JoinOut(StudentOut):
    student_token: str


class ResponseIn(BaseModel):
    question_id: int
    answer: Str100
    explanation: OptStr2000 = ""
    self_confidence: Confidence
    time_spent_seconds: int | None = Field(default=None, ge=0, le=7200)
    timed_out: bool = False  # the question's timer hit zero and the app auto-submitted
    ran_out_of_time: bool = False  # the student ticked "I ran out of time"


class FollowUpOut(BaseModel):
    follow_up_id: int
    question_text: str


class SubmitOut(BaseModel):
    response_id: int
    follow_up: FollowUpOut | None


class ReplyIn(BaseModel):
    reply: Str1000


class DeclineIn(BaseModel):
    reason: Literal["skip", "not_sure", "teacher"]


class ReplyOut(BaseModel):
    status: Literal["done"] = "done"


# ---------- teacher results ----------

class StudentEntry(BaseModel):
    student_id: int
    nickname: str
    response_id: int
    label: Label
    misconception_label: str | None
    certainty: float
    status: Status
    source: Source


class LabelGroup(BaseModel):
    label: Label
    count: int
    students: list[StudentEntry]


class StoryCount(BaseModel):
    label: Label
    misconception_label: str | None
    count: int


class WrongAnswerGroup(BaseModel):
    """Everyone who gave the same wrong answer, and the different stories behind it."""

    answer: str
    count: int
    several_stories: bool
    stories: list[StoryCount]
    students: list[StudentEntry]


class CorrectnessGroup(BaseModel):
    is_correct: bool
    count: int
    labels: list[LabelGroup]


class QuestionResults(BaseModel):
    question_id: int
    position: int
    prompt: str
    correct_answer: str
    total_responses: int
    same_score_different_reasons: bool
    same_wrong_answer_different_stories: bool
    groups: list[CorrectnessGroup]
    wrong_answers: list[WrongAnswerGroup]


class ResultsOut(BaseModel):
    class_id: int
    total_students: int
    rule_only_count: int
    questions: list[QuestionResults]


class HypothesisView(BaseModel):
    kind: HypothesisKind
    misconception_id: int | None
    misconception_label: str | None
    evidence_for: str
    evidence_against: str
    likelihood: float
    status: HypStatus
    would_confirm: str


class DiagnosisView(BaseModel):
    diagnosis_id: int
    version: int
    label: Label
    misconception_id: int | None
    misconception_label: str | None
    certainty: float
    source: Source
    status: Status
    note: str
    created_at: datetime
    hypotheses: list[HypothesisView]


class HistoryEntry(BaseModel):
    version: int
    label: Label
    source: Source
    certainty: float
    status: Status
    created_at: datetime


class ExpectedEvidenceView(BaseModel):
    kind: HypothesisKind
    misconception_id: int | None
    observation: str


class FollowUpView(BaseModel):
    question_text: str
    student_reply: str | None
    answered_at: datetime | None
    rationale: str = ""
    expected_evidence: list[ExpectedEvidenceView] = Field(default_factory=list)
    declined_reason: str = ""


class TraceView(BaseModel):
    step: str
    source: str
    model: str | None
    prompt_version: str | None
    latency_ms: int
    ok: bool
    detail: str | None


class ResponseDetail(BaseModel):
    response_id: int
    student_id: int
    nickname: str
    question: QuestionOut
    answer: str
    explanation: str
    self_confidence: Confidence
    is_correct: bool
    time_spent_seconds: int | None
    timed_out: bool
    ran_out_of_time: bool
    created_at: datetime
    diagnosis: DiagnosisView
    history: list[HistoryEntry]
    follow_up: FollowUpView | None
    trace: list[TraceView]


class OverrideIn(BaseModel):
    label: Label
    misconception_id: int | None = None
    note: OptStr500 = ""
