from fastapi import APIRouter, Depends, status

from app.api.deps import AIDep, AppSettings, CurrentStudent, DbSession
from app.rate_limit import limit_public, limit_student
from app.schemas import JoinIn, JoinOut, ReplyIn, ReplyOut, StudentOut
from app.services.diagnosis_store import reply_to_follow_up
from app.services.students import join_class, student_out

router = APIRouter(prefix="/api", tags=["students"])


@router.post("/join", status_code=status.HTTP_201_CREATED, dependencies=[Depends(limit_public)])
def join(body: JoinIn, db: DbSession) -> JoinOut:
    student, token = join_class(db, body.join_code, body.nickname)
    db.commit()
    return JoinOut(**student_out(student).model_dump(), student_token=token)


@router.get("/students/me")
def me(student: CurrentStudent) -> StudentOut:
    return student_out(student)


@router.post("/follow-ups/{follow_up_id}/reply", dependencies=[Depends(limit_student)])
def reply(
    follow_up_id: int, body: ReplyIn, student: CurrentStudent, db: DbSession, ai: AIDep, settings: AppSettings
) -> ReplyOut:
    reply_to_follow_up(db, student, follow_up_id, body.reply, ai, settings)
    db.commit()
    return ReplyOut()
