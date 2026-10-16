"""User and Teacher account authentication endpoints."""
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models
from app.api.deps import get_db
from app.schemas import (
    AuthOut,
    LinkClassIn,
    LinkStudentIn,
    StudentEnrollmentItem,
    TeacherClassItem,
    UserLoginIn,
    UserOut,
    UserProfileOut,
    UserRegisterIn,
)
from app.security import hash_password, new_auth_token, token_matches, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def get_auth_token(
    authorization: str | None = Header(None, alias="Authorization"),
    x_auth_token: str | None = Header(None, alias="X-Auth-Token"),
) -> str | None:
    if x_auth_token:
        return x_auth_token.strip()
    if authorization:
        parts = authorization.strip().split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1]
        return authorization.strip()
    return None


def get_optional_user(
    token: str | None = Depends(get_auth_token),
    db: Session = Depends(get_db),
) -> models.User | None:
    if not token:
        return None
    return db.scalar(select(models.User).where(models.User.auth_token == token))


def get_current_user(
    user: models.User | None = Depends(get_optional_user),
) -> models.User:
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
        )
    return user


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=AuthOut)
def register(body: UserRegisterIn, db: Session = Depends(get_db)) -> AuthOut:
    clean_email = body.email.strip().lower()
    clean_username = body.username.strip().lower()

    if not clean_email or "@" not in clean_email:
        raise HTTPException(status_code=422, detail="A valid email address is required.")
    if len(clean_username) < 3:
        raise HTTPException(status_code=422, detail="Username must be at least 3 characters.")
    if len(body.password) < 6:
        raise HTTPException(status_code=422, detail="Password must be at least 6 characters.")

    existing_email = db.scalar(select(models.User.id).where(func.lower(models.User.email) == clean_email))
    if existing_email:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    existing_username = db.scalar(select(models.User.id).where(func.lower(models.User.username) == clean_username))
    if existing_username:
        raise HTTPException(status_code=409, detail="An account with this username already exists.")

    token = new_auth_token()
    user = models.User(
        role=body.role,
        email=clean_email,
        username=clean_username,
        full_name=body.full_name.strip(),
        password_hash=hash_password(body.password),
        auth_token=token,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return AuthOut(
        token=token,
        user=UserOut(
            id=user.id,
            role=user.role,
            email=user.email,
            username=user.username,
            full_name=user.full_name,
            created_at=user.created_at,
        ),
    )


@router.post("/login", response_model=AuthOut)
def login(body: UserLoginIn, db: Session = Depends(get_db)) -> AuthOut:
    ident = body.identifier.strip().lower()
    user = db.scalar(
        select(models.User).where(
            (func.lower(models.User.email) == ident) | (func.lower(models.User.username) == ident)
        )
    )

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/username or password.",
        )

    # Maintain stable auth token across sessions
    token = user.auth_token or new_auth_token()
    if not user.auth_token:
        user.auth_token = token
        db.commit()

    return AuthOut(
        token=token,
        user=UserOut(
            id=user.id,
            role=user.role,
            email=user.email,
            username=user.username,
            full_name=user.full_name,
            created_at=user.created_at,
        ),
    )


@router.get("/me", response_model=UserProfileOut)
def me(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserProfileOut:
    classes_out: list[TeacherClassItem] = []
    enrollments_out: list[StudentEnrollmentItem] = []

    if user.role == "teacher":
        classes = db.scalars(
            select(models.ClassRoom)
            .where(models.ClassRoom.teacher_user_id == user.id)
            .order_by(models.ClassRoom.created_at.desc())
        ).all()
        for c in classes:
            q_count = len(c.quiz.questions) if c.quiz else 0
            classes_out.append(
                TeacherClassItem(
                    class_id=c.id,
                    name=c.name,
                    join_code=c.join_code,
                    teacher_token=None,
                    is_sample=c.is_sample,
                    created_at=c.created_at,
                    student_count=len(c.students),
                    question_count=q_count,
                )
            )
    elif user.role == "student":
        students = db.scalars(
            select(models.Student)
            .where(models.Student.user_id == user.id)
            .order_by(models.Student.created_at.desc())
        ).all()
        for s in students:
            cls = s.classroom
            total_q = len(cls.quiz.questions) if cls and cls.quiz else 0
            enrollments_out.append(
                StudentEnrollmentItem(
                    student_id=s.id,
                    class_id=cls.id if cls else 0,
                    class_name=cls.name if cls else "Unknown Class",
                    nickname=s.nickname,
                    student_token=None,
                    answered_count=len(s.responses),
                    total_questions=total_q,
                )
            )

    return UserProfileOut(
        user=UserOut(
            id=user.id,
            role=user.role,
            email=user.email,
            username=user.username,
            full_name=user.full_name,
            created_at=user.created_at,
        ),
        classes=classes_out,
        enrollments=enrollments_out,
    )


@router.post("/link-class")
def link_class(
    body: LinkClassIn,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role != "teacher":
        raise HTTPException(status_code=403, detail="Only teacher accounts can link classes.")

    cls = db.scalar(select(models.ClassRoom).where(models.ClassRoom.id == body.class_id))
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found.")

    if not token_matches(body.teacher_token, cls.teacher_token_hash):
        raise HTTPException(status_code=403, detail="Invalid teacher token.")

    cls.teacher_user_id = user.id
    db.commit()
    return {"status": "linked", "class_id": cls.id, "class_name": cls.name}


@router.post("/link-student")
def link_student(
    body: LinkStudentIn,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Only student accounts can link class enrollments.")

    clean_code = body.join_code.strip().upper()
    cls = db.scalar(select(models.ClassRoom).where(models.ClassRoom.join_code == clean_code))
    if not cls:
        raise HTTPException(status_code=404, detail="No class found with that join code.")

    student = db.scalar(
        select(models.Student).where(
            models.Student.class_id == cls.id,
            func.lower(models.Student.nickname) == body.nickname.strip().lower(),
        )
    )
    if not student:
        raise HTTPException(status_code=404, detail="No student found with that nickname in this class.")

    student.user_id = user.id
    db.commit()
    return {"status": "linked", "student_id": student.id, "nickname": student.nickname}
