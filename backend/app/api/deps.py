"""Shared FastAPI dependencies: DB session, settings, AI client, and link-token auth."""
from typing import Annotated

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.client import AIClient, get_ai_client
from app.config import Settings, get_settings
from app.db import get_db
from app.models import ClassRoom, Response, Student
from app.security import hash_token, token_matches

DbSession = Annotated[Session, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_settings)]
AIDep = Annotated[AIClient, Depends(get_ai_client)]


def _check_teacher(cls: ClassRoom, token: str | None) -> None:
    if not token:
        raise HTTPException(status_code=401, detail="Teacher link required.")
    if not token_matches(token, cls.teacher_token_hash):
        raise HTTPException(status_code=403, detail="This teacher link doesn't match the class.")


def require_teacher(
    class_id: int, db: DbSession, x_teacher_token: Annotated[str | None, Header()] = None
) -> ClassRoom:
    cls = db.get(ClassRoom, class_id)
    if cls is None:
        raise HTTPException(status_code=404, detail="Class not found.")
    _check_teacher(cls, x_teacher_token)
    return cls


def require_teacher_for_response(
    response_id: int, db: DbSession, x_teacher_token: Annotated[str | None, Header()] = None
) -> Response:
    response = db.get(Response, response_id)
    if response is None:
        raise HTTPException(status_code=404, detail="Response not found.")
    _check_teacher(response.student.classroom, x_teacher_token)
    return response


def require_student(db: DbSession, x_student_token: Annotated[str | None, Header()] = None) -> Student:
    if not x_student_token:
        raise HTTPException(status_code=401, detail="Join the class first.")
    student = db.scalar(select(Student).where(Student.token_hash == hash_token(x_student_token)))
    if student is None:
        raise HTTPException(status_code=401, detail="Unknown student — join the class again.")
    return student


TeacherClass = Annotated[ClassRoom, Depends(require_teacher)]
TeacherResponse = Annotated[Response, Depends(require_teacher_for_response)]
CurrentStudent = Annotated[Student, Depends(require_student)]
