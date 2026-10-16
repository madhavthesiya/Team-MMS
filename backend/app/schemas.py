"""Request/response models for the HTTP API. Mirrors docs/api-contract.md."""
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, model_validator

from app.domain import AnswerType, Confidence, HypothesisKind, HypStatus, Label, Source, Status
from app.services.normalizer import answers_match, normalize_text


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


def _check_choices(answer_type: str, correct_answer: str, choices: list[str]) -> None:
    if answer_type == "choice":
        if len(choices) < 2:
            raise ValueError("choice questions need at least 2 choices")
        if not any(answers_match(correct_answer, c, "choice") for c in choices):
            raise ValueError("correct_answer must be one of the choices")


class TransferItemIn(BaseModel):
    """The same key idea in a changed situation, used for later re-checks (Riddle 4)."""

    prompt: Str1000
    correct_answer: Str100
    answer_type: AnswerType
    choices: list[Str100] = Field(default_factory=list, max_length=6)
    change: Str80  # what is different from the original question, e.g. "word problem", "asks for the smaller one"

    @model_validator(mode="after")
    def _consistent(self) -> "TransferItemIn":
        _check_choices(self.answer_type, self.correct_answer, self.choices)
        return self


class QuestionIn(BaseModel):
    prompt: Str1000
    correct_answer: Str100
    answer_type: AnswerType
    key_idea: Str1000
    choices: list[Str100] = Field(default_factory=list, max_length=6)
    misconceptions: list[MisconceptionIn] = Field(default_factory=list, max_length=6)
    time_limit_seconds: int | None = Field(default=None, ge=10, le=3600)
    transfer_items: list[TransferItemIn] = Field(default_factory=list, max_length=6)

    @model_validator(mode="after")
    def _consistent(self) -> "QuestionIn":
        _check_choices(self.answer_type, self.correct_answer, self.choices)
        for m in self.misconceptions:
            for trigger in m.trigger_answers:
                if answers_match(trigger, self.correct_answer, self.answer_type):
                    raise ValueError(f"trigger answer '{trigger}' is the correct answer")
        for item in self.transfer_items:
            if normalize_text(item.prompt) == normalize_text(self.prompt):
                raise ValueError("a re-check item must change the situation, not repeat the question")
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


class TransferItemOut(BaseModel):
    transfer_item_id: int
    prompt: str
    correct_answer: str
    answer_type: AnswerType
    choices: list[str]
    change: str


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
    transfer_items: list[TransferItemOut] = Field(default_factory=list)


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


class StudentRecheckOut(BaseModel):
    """A check-in that is open now. Deliberately says nothing about the original question or the change."""

    recheck_id: int
    prompt: str
    answer_type: AnswerType
    choices: list[str]


class StudentOut(BaseModel):
    student_id: int
    nickname: str
    class_name: str
    quiz: StudentQuizOut | None
    answered_question_ids: list[int]
    pending_follow_ups: list[PendingFollowUpOut]
    rechecks: list[StudentRecheckOut] = Field(default_factory=list)


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


Verdict = Literal["pending", "lasting", "travelled", "unconvincing", "did_not_travel"]


class RecheckAnswerIn(BaseModel):
    answer: Str100
    explanation: OptStr2000 = ""
    self_confidence: Confidence
    time_spent_seconds: int | None = Field(default=None, ge=0, le=7200)


class ScheduleRechecksIn(BaseModel):
    question_id: int
    student_ids: list[int] | None = None  # None: everyone in the class who answered the question
    delay_days: int = Field(default=7, ge=0, le=90)
    next_step: OptStr500 = ""  # what you are offering before the re-check; default comes from each student's story


class ScheduledRecheck(BaseModel):
    recheck_id: int
    student_id: int
    nickname: str
    transfer_item_id: int
    change: str
    available_at: datetime
    next_step: str


class SkippedStudent(BaseModel):
    student_id: int
    nickname: str
    reason: str


class ScheduleRechecksOut(BaseModel):
    scheduled: list[ScheduledRecheck]
    skipped: list[SkippedStudent]


class RecheckHypothesis(BaseModel):
    kind: HypothesisKind
    misconception_label: str | None
    evidence_for: str
    evidence_against: str
    likelihood: float
    status: HypStatus
    would_confirm: str


class RecheckView(BaseModel):
    recheck_id: int
    student_id: int
    nickname: str
    question_id: int
    transfer_item: TransferItemOut
    next_step: str
    created_at: datetime
    available_at: datetime
    answered_at: datetime | None
    answer: str | None
    explanation: str | None
    self_confidence: Confidence | None
    time_spent_seconds: int | None
    is_correct: bool | None
    reading_label: Label | None
    reading_source: Source | None
    misconception_label: str | None
    hypotheses: list[RecheckHypothesis]
    gap_days: float | None
    verdict: Verdict
    change_plan: str
    original_correct: bool | None
    original_label: Label | None


class TransferQuestionReport(BaseModel):
    question_id: int
    position: int
    prompt: str
    transfer_item_count: int
    scheduled: int
    waiting: int  # scheduled but not open yet
    answered: int
    better_marks: int  # answered re-checks with a right answer
    better_understanding: int  # ...whose explanation also showed the key idea (travelled or lasted)
    verdicts: dict[str, int]
    rechecks: list[RecheckView]


class TransferReport(BaseModel):
    class_id: int
    lasting_days: float
    questions: list[TransferQuestionReport]


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
    rechecks: list[RecheckView] = Field(default_factory=list)


class OverrideIn(BaseModel):
    label: Label
    misconception_id: int | None = None
    note: OptStr500 = ""


# ---------- AI Features ----------

class ScriptTurn(BaseModel):
    teacher_prompt: str
    anticipated_student_thinking: str


class AIInterventionOut(BaseModel):
    student_nickname: str
    diagnosed_label: str
    misconception_name: str | None
    misconception_breakdown: str
    one_on_one_script: list[ScriptTurn]
    concrete_counterexample: str
    check_for_understanding_question: str
    generated_by_model: str


class AIGenerateQuestionIn(BaseModel):
    topic: Str100
    grade_level: Str80 = "Middle School"
    misconception_focus: OptStr500 = ""


class AIMisconceptionDraft(BaseModel):
    label: str
    trigger_answers: list[str] = Field(default_factory=list)
    signal_text: str = ""
    remedy_hint: str = ""


class AIGenerateQuestionOut(BaseModel):
    prompt: str
    correct_answer: str
    answer_type: AnswerType
    key_idea: str
    choices: list[str] = Field(default_factory=list)
    misconceptions: list[AIMisconceptionDraft] = Field(default_factory=list)
    time_limit_seconds: int = 90


class DifferentiatedGroup(BaseModel):
    group_name: str
    focus_story: str
    student_count: int
    student_nicknames: list[str]
    suggested_action: str


class AISummaryOut(BaseModel):
    class_name: str
    quiz_topic: str
    total_students: int
    correct_count: int
    accuracy_percentage: float
    executive_summary: str
    dominant_misconception: str
    undercover_guessers_warning: str
    ten_minute_reteach_plan: list[str]
    differentiated_groups: list[DifferentiatedGroup]
    generated_by_model: str

