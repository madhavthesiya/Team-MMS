from fastapi import APIRouter, Depends, status
from fastapi import Response as HttpResponse

from app import models
from app.api.auth import get_optional_user
from app.api.deps import AIDep, AppSettings, DbSession, TeacherClass
from app.rate_limit import limit_public
from app.schemas import (
    AIGenerateQuestionIn,
    AIGenerateQuestionOut,
    AISummaryOut,
    ClassCreate,
    ClassCreated,
    ClassOut,
    QuizIn,
    QuizOut,
    ResultsOut,
    ScheduleRechecksIn,
    ScheduleRechecksOut,
    TransferItemIn,
    TransferItemOut,
    TransferReport,
)
from app.services.ai_features import generate_ai_question, generate_class_ai_summary
from app.services.classrooms import class_out, create_classroom, quiz_out, replace_quiz
from app.services.results import build_results
from app.services.sample import SAMPLE_CLASS_NAME, load_sample_quiz
from app.services.transfer import add_transfer_item, schedule_rechecks, transfer_item_out, transfer_report

router = APIRouter(prefix="/api/classes", tags=["classes"])



@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Depends(limit_public)])
def create_class(
    body: ClassCreate, db: DbSession, user: models.User | None = Depends(get_optional_user)
) -> ClassCreated:
    cls, token = create_classroom(db, body.name)
    if user and user.role == "teacher":
        cls.teacher_user_id = user.id
    db.commit()
    return ClassCreated(class_id=cls.id, name=cls.name, join_code=cls.join_code, teacher_token=token)


@router.post("/sample", status_code=status.HTTP_201_CREATED, dependencies=[Depends(limit_public)])
def create_sample_class(
    db: DbSession, user: models.User | None = Depends(get_optional_user)
) -> ClassCreated:
    cls, token = create_classroom(db, SAMPLE_CLASS_NAME, is_sample=True)
    if user and user.role == "teacher":
        cls.teacher_user_id = user.id
    replace_quiz(db, cls, load_sample_quiz())
    db.commit()
    return ClassCreated(class_id=cls.id, name=cls.name, join_code=cls.join_code, teacher_token=token)


@router.get("/{class_id}")
def get_class(cls: TeacherClass) -> ClassOut:
    return class_out(cls)


@router.put("/{class_id}/quiz")
def put_quiz(body: QuizIn, cls: TeacherClass, db: DbSession) -> QuizOut:
    quiz = replace_quiz(db, cls, body)
    db.commit()
    return quiz_out(quiz)


@router.get("/{class_id}/results")
def get_results(cls: TeacherClass, db: DbSession) -> ResultsOut:
    return build_results(db, cls)


@router.post("/{class_id}/ai-generate-question")
def ai_generate_question(body: AIGenerateQuestionIn, cls: TeacherClass, ai: AIDep) -> AIGenerateQuestionOut:
    """Generate a conceptual diagnostic question with researched misconceptions."""
    return generate_ai_question(body, ai)


@router.post("/{class_id}/ai-summary")
def ai_class_summary(cls: TeacherClass, db: DbSession, ai: AIDep) -> AISummaryOut:
    """Generate classroom-wide cognitive executive synthesis and 10-minute warm-up reteach plan."""
    return generate_class_ai_summary(db, cls, ai)


@router.delete("/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_class(cls: TeacherClass, db: DbSession) -> HttpResponse:
    db.delete(cls)
    db.commit()
    return HttpResponse(status_code=status.HTTP_204_NO_CONTENT)


# ---------- Riddle 4: does the understanding travel and last? ----------


@router.post("/{class_id}/questions/{question_id}/transfer-items", status_code=status.HTTP_201_CREATED)
def create_transfer_item(question_id: int, body: TransferItemIn, cls: TeacherClass, db: DbSession) -> TransferItemOut:
    """Add the same idea in a new situation. Allowed after students have answered: it adds no evidence."""
    item = add_transfer_item(db, cls, question_id, body)
    db.commit()
    return transfer_item_out(item)


@router.post("/{class_id}/rechecks", status_code=status.HTTP_201_CREATED)
def create_rechecks(body: ScheduleRechecksIn, cls: TeacherClass, db: DbSession) -> ScheduleRechecksOut:
    """Offer a next step and schedule an unaided re-check in a changed situation, after a delay."""
    result = schedule_rechecks(db, cls, body)
    db.commit()
    return result


@router.get("/{class_id}/transfer")
def get_transfer_report(cls: TeacherClass, db: DbSession, settings: AppSettings) -> TransferReport:
    """Better marks vs better understanding, per question, with every re-check and its verdict."""
    return transfer_report(db, cls, settings)
