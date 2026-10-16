"""Idempotent seed script to create real Teacher and Student user accounts and classes."""
import json
from pathlib import Path
from sqlalchemy.orm import Session

from app import models
from app.schemas import QuizIn
from app.security import hash_password, hash_token
from app.services.classrooms import replace_quiz

DEMO_CLASS_ID = 11
DEMO_CLASS_NAME = "Grade 7 Mathematics — Fractions Diagnostic"
DEMO_JOIN_CODE = "MMS789"
DEMO_TEACHER_TOKEN = "Pf9mwSMKDrCKo9__oosrYCztuzeKNFc-"
STUDENT_USER_TOKEN = "student-user-demo-token-12345"
ASHA_TOKEN = "token-asha-mms-student-01"
LEO_TOKEN = "token-leo-mms-student-02"

TEACHER_EMAIL = "teacher@school.edu"
TEACHER_USERNAME = "teacher_mms"
TEACHER_PASSWORD = "Password123!"
TEACHER_AUTH_TOKEN = "auth-token-teacher-mms-2026"

STUDENT_EMAIL = "student@school.edu"
STUDENT_USERNAME = "student_user"
STUDENT_PASSWORD = "Password123!"
STUDENT_AUTH_TOKEN = "auth-token-student-mms-2026"


def seed_demo_accounts(session: Session) -> dict:
    """Create or verify real Teacher and Student user accounts, classes, and records."""
    # 1. Create or verify Teacher User Account
    teacher_user = session.query(models.User).filter_by(email=TEACHER_EMAIL).first()
    if not teacher_user:
        teacher_user = models.User(
            role="teacher",
            email=TEACHER_EMAIL,
            username=TEACHER_USERNAME,
            full_name="Prof. MMS Teacher",
            password_hash=hash_password(TEACHER_PASSWORD),
            auth_token=TEACHER_AUTH_TOKEN,
        )
        session.add(teacher_user)
        session.flush()

    # 2. Create or verify Student User Account
    student_user_acc = session.query(models.User).filter_by(email=STUDENT_EMAIL).first()
    if not student_user_acc:
        student_user_acc = models.User(
            role="student",
            email=STUDENT_EMAIL,
            username=STUDENT_USERNAME,
            full_name="Student User",
            password_hash=hash_password(STUDENT_PASSWORD),
            auth_token=STUDENT_AUTH_TOKEN,
        )
        session.add(student_user_acc)
        session.flush()

    # 3. Create or verify Class 11
    c11 = session.query(models.ClassRoom).filter_by(id=DEMO_CLASS_ID).first()
    if not c11:
        c11 = models.ClassRoom(
            id=DEMO_CLASS_ID,
            name=DEMO_CLASS_NAME,
            join_code=DEMO_JOIN_CODE,
            teacher_token_hash=hash_token(DEMO_TEACHER_TOKEN),
            teacher_user_id=teacher_user.id,
            is_sample=False,
        )
        session.add(c11)
        session.flush()

        quiz_file = Path(__file__).resolve().parents[1] / "sample" / "fractions_quiz.json"
        if quiz_file.exists():
            quiz_data = QuizIn.model_validate(json.loads(quiz_file.read_text(encoding="utf-8")))
            replace_quiz(session, c11, quiz_data)
        session.flush()
    else:
        if c11.teacher_user_id != teacher_user.id:
            c11.teacher_user_id = teacher_user.id

    # 4. Ensure Students exist in Class 11
    asha = session.query(models.Student).filter_by(class_id=DEMO_CLASS_ID, nickname="Asha").first()
    if not asha:
        asha = models.Student(class_id=DEMO_CLASS_ID, nickname="Asha", token_hash=hash_token(ASHA_TOKEN))
        session.add(asha)
        session.flush()

        if c11.quiz and c11.quiz.questions:
            q1 = c11.quiz.questions[0]
            resp_asha = models.Response(
                student_id=asha.id,
                question_id=q1.id,
                answer_raw="3/4",
                explanation_raw="I found a common denominator: 1/2 is 2/4, so 2/4 + 1/4 = 3/4.",
                self_confidence="sure",
                is_correct=True,
                time_spent_seconds=22,
                timed_out=False,
                reported_out_of_time=False,
            )
            session.add(resp_asha)
            session.flush()

            diag_asha = models.Diagnosis(
                response_id=resp_asha.id,
                version=1,
                label="understood",
                certainty=0.96,
                source="both",
                status="settled",
                note="Clear conversion of denominator followed by valid fraction addition.",
            )
            session.add(diag_asha)
            session.flush()

            hyp_asha = models.Hypothesis(
                diagnosis_id=diag_asha.id,
                kind="understood",
                evidence_for="converted 1/2 to 2/4",
                evidence_against="",
                likelihood=0.96,
                status="supported",
                would_confirm="Applies common denominator correctly to third problem",
            )
            session.add(hyp_asha)

    leo = session.query(models.Student).filter_by(class_id=DEMO_CLASS_ID, nickname="Leo").first()
    if not leo:
        leo = models.Student(class_id=DEMO_CLASS_ID, nickname="Leo", token_hash=hash_token(LEO_TOKEN))
        session.add(leo)
        session.flush()

        if c11.quiz and c11.quiz.questions:
            q1 = c11.quiz.questions[0]
            resp_leo = models.Response(
                student_id=leo.id,
                question_id=q1.id,
                answer_raw="2/6",
                explanation_raw="I added numerators 1+1=2 and denominators 2+4=6 to get 2/6.",
                self_confidence="sure",
                is_correct=False,
                time_spent_seconds=31,
                timed_out=False,
                reported_out_of_time=False,
            )
            session.add(resp_leo)
            session.flush()

            misc_id = q1.misconceptions[0].id if q1.misconceptions else None
            diag_leo = models.Diagnosis(
                response_id=resp_leo.id,
                version=1,
                label="misconception",
                certainty=0.94,
                source="both",
                status="settled",
                misconception_id=misc_id,
                note="Adds numerators and denominators across.",
            )
            session.add(diag_leo)
            session.flush()

            hyp_leo = models.Hypothesis(
                diagnosis_id=diag_leo.id,
                kind="misconception",
                misconception_id=misc_id,
                evidence_for="I added numerators 1+1=2 and denominators 2+4=6",
                evidence_against="",
                likelihood=0.94,
                status="supported",
                would_confirm="Repeats across denominators on 1/3 + 1/5",
            )
            session.add(hyp_leo)

    user_student = session.query(models.Student).filter_by(class_id=DEMO_CLASS_ID, nickname="StudentUser").first()
    if not user_student:
        user_student = models.Student(
            class_id=DEMO_CLASS_ID,
            nickname="StudentUser",
            token_hash=hash_token(STUDENT_USER_TOKEN),
            user_id=student_user_acc.id,
        )
        session.add(user_student)
    else:
        if user_student.user_id != student_user_acc.id:
            user_student.user_id = student_user_acc.id

    session.commit()

    return {
        "teacher_account": {
            "email": TEACHER_EMAIL,
            "username": TEACHER_USERNAME,
            "password": TEACHER_PASSWORD,
            "auth_token": TEACHER_AUTH_TOKEN,
            "class_id": DEMO_CLASS_ID,
            "class_name": c11.name,
            "join_code": c11.join_code,
            "teacher_url": f"/teacher/{DEMO_CLASS_ID}#{DEMO_TEACHER_TOKEN}",
        },
        "student_account": {
            "email": STUDENT_EMAIL,
            "username": STUDENT_USERNAME,
            "password": STUDENT_PASSWORD,
            "auth_token": STUDENT_AUTH_TOKEN,
            "student_nickname": user_student.nickname,
            "student_token": STUDENT_USER_TOKEN,
            "join_code": c11.join_code,
        },
    }
