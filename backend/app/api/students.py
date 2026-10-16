from fastapi import APIRouter, Depends, status

from app import models
from app.api.auth import get_optional_user
from app.api.deps import AIDep, AppSettings, CurrentStudent, DbSession
from app.rate_limit import limit_public, limit_student
from app.schemas import DeclineIn, JoinIn, JoinOut, RecheckAnswerIn, ReplyIn, ReplyOut, StudentOut
from app.services.diagnosis_store import decline_follow_up, reply_to_follow_up, resume_follow_up
from app.services.students import join_class, student_out
from app.services.transfer import answer_recheck

router = APIRouter(prefix="/api", tags=["students"])


@router.post("/join", status_code=status.HTTP_201_CREATED, dependencies=[Depends(limit_public)])
def join(body: JoinIn, db: DbSession, user: models.User | None = Depends(get_optional_user)) -> JoinOut:
    student, token = join_class(db, body.join_code, body.nickname)
    if user and user.role == "student":
        student.user_id = user.id
    db.commit()
    return JoinOut(**student_out(student).model_dump(), student_token=token)


@router.get("/students/me")
def me(student: CurrentStudent) -> StudentOut:
    return student_out(student)


@router.post("/follow-ups/{follow_up_id}/reply", dependencies=[Depends(limit_student)])
def reply(
    follow_up_id: int, body: ReplyIn, student: CurrentStudent, db: DbSession, ai: AIDep, settings: AppSettings
) -> ReplyOut:
    reply_to_follow_up(db, student, follow_up_id, body.reply, ai, settings)  # commits its own writes
    return ReplyOut()


@router.post("/follow-ups/{follow_up_id}/resume", dependencies=[Depends(limit_student)])
def resume(follow_up_id: int, student: CurrentStudent, db: DbSession, ai: AIDep, settings: AppSettings) -> ReplyOut:
    """Finish processing a saved reply (after a timeout, crash or failed save). Safe to repeat."""
    resume_follow_up(db, student, follow_up_id, ai, settings)
    return ReplyOut()


@router.post("/follow-ups/{follow_up_id}/decline", dependencies=[Depends(limit_student)])
def decline(follow_up_id: int, body: DeclineIn, student: CurrentStudent, db: DbSession) -> ReplyOut:
    """Stop the optional check without asking the model to interpret a refusal."""
    decline_follow_up(db, student, follow_up_id, body.reason)
    return ReplyOut()


@router.post("/rechecks/{recheck_id}/answer", dependencies=[Depends(limit_student)])
def answer_check_in(
    recheck_id: int, body: RecheckAnswerIn, student: CurrentStudent, db: DbSession, ai: AIDep, settings: AppSettings
) -> ReplyOut:
    """Riddle 4: a later check-in in a changed situation, answered without follow-ups or hints.
    Like every student endpoint, it never returns correctness or a verdict."""
    answer_recheck(db, student, recheck_id, body, ai, settings)  # commits its own write
    return ReplyOut()
