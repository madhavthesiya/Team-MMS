"""Tests for User (Student) and Teacher account registration, login, and class association."""
import pytest
from fastapi.testclient import TestClient

from app.config import Settings


def test_register_and_login_teacher(make_client, settings: Settings):
    client = make_client(settings)

    # 1. Register a teacher
    reg_res = client.post(
        "/api/auth/register",
        json={
            "role": "teacher",
            "email": "sarah.connor@school.edu",
            "username": "sarah_c",
            "full_name": "Sarah Connor",
            "password": "Password123!",
        },
    )
    assert reg_res.status_code == 201, reg_res.text
    data = reg_res.json()
    assert "token" in data
    assert data["user"]["email"] == "sarah.connor@school.edu"
    assert data["user"]["username"] == "sarah_c"
    assert data["user"]["role"] == "teacher"

    # 2. Cannot register duplicate email
    dup_email = client.post(
        "/api/auth/register",
        json={
            "role": "teacher",
            "email": "SARAH.CONNOR@school.edu",
            "username": "other_sarah",
            "full_name": "Other",
            "password": "Password123!",
        },
    )
    assert dup_email.status_code == 409

    # 3. Cannot register duplicate username
    dup_user = client.post(
        "/api/auth/register",
        json={
            "role": "teacher",
            "email": "different@school.edu",
            "username": "SARAH_C",
            "full_name": "Other",
            "password": "Password123!",
        },
    )
    assert dup_user.status_code == 409

    # 4. Login with email
    login_res = client.post(
        "/api/auth/login",
        json={"identifier": "sarah.connor@school.edu", "password": "Password123!"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["token"]

    # 5. Login with username
    login_user_res = client.post(
        "/api/auth/login",
        json={"identifier": "sarah_c", "password": "Password123!"},
    )
    assert login_user_res.status_code == 200

    # 6. Login with wrong password
    bad_login = client.post(
        "/api/auth/login",
        json={"identifier": "sarah_c", "password": "WrongPassword"},
    )
    assert bad_login.status_code == 401

    # 7. Check /me
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["user"]["username"] == "sarah_c"
    assert me_data["classes"] == []


def test_teacher_creates_class_and_views_in_profile(make_client, settings: Settings):
    client = make_client(settings)

    # Register teacher
    reg_res = client.post(
        "/api/auth/register",
        json={
            "role": "teacher",
            "email": "teacher@math.org",
            "username": "math_teacher",
            "full_name": "Math Teacher",
            "password": "Password123!",
        },
    )
    token = reg_res.json()["token"]

    # Create a class with auth header
    cls_res = client.post(
        "/api/classes",
        json={"name": "Period 1 Math"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert cls_res.status_code == 201
    cls_id = cls_res.json()["class_id"]

    # Profile should list this class
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    classes = me_res.json()["classes"]
    assert len(classes) == 1
    assert classes[0]["class_id"] == cls_id
    assert classes[0]["name"] == "Period 1 Math"


def test_student_account_registration_and_enrollment(make_client, settings: Settings):
    client = make_client(settings)

    # Teacher creates a class
    cls_res = client.post("/api/classes/sample")
    assert cls_res.status_code == 201
    join_code = cls_res.json()["join_code"]

    # Register a student account
    reg_res = client.post(
        "/api/auth/register",
        json={
            "role": "student",
            "email": "alex@student.edu",
            "username": "alex99",
            "full_name": "Alex Smith",
            "password": "Password123!",
        },
    )
    assert reg_res.status_code == 201
    student_auth_token = reg_res.json()["token"]

    # Student joins class with auth header
    join_res = client.post(
        "/api/join",
        json={"join_code": join_code, "nickname": "AlexS"},
        headers={"Authorization": f"Bearer {student_auth_token}"},
    )
    assert join_res.status_code == 201

    # Student profile should now show the enrolled class
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {student_auth_token}"})
    assert me_res.status_code == 200
    enrollments = me_res.json()["enrollments"]
    assert len(enrollments) == 1
    assert enrollments[0]["nickname"] == "AlexS"
    assert enrollments[0]["total_questions"] > 0
