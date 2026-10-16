#!/usr/bin/env python3
"""CLI script to seed real demo Teacher and Student user accounts."""
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend_dir))

from app.config import get_settings
from app.db import configure_db, get_db
from app.services.seed import seed_demo_accounts


def main():
    settings = get_settings()
    configure_db(settings.sqlalchemy_url)
    session = next(get_db())

    print("Seeding real accounts in BehindTheMark...")
    res = seed_demo_accounts(session)
    t = res["teacher_account"]
    s = res["student_account"]

    print("\n================ REAL TEACHER ACCOUNT ================")
    print(f"Email:        {t['email']}")
    print(f"Username:     {t['username']}")
    print(f"Password:     {t['password']}")
    print(f"Auth Token:   {t['auth_token']}")
    print(f"Active Class: {t['class_name']} (ID: {t['class_id']})")
    print(f"Join Code:    {t['join_code']}")
    print(f"Teacher URL:  http://127.0.0.1:8080{t['teacher_url']}")

    print("\n================ REAL STUDENT USER ACCOUNT ===========")
    print(f"Email:        {s['email']}")
    print(f"Username:     {s['username']}")
    print(f"Password:     {s['password']}")
    print(f"Auth Token:   {s['auth_token']}")
    print(f"Nickname:     {s['student_nickname']}")
    print(f"Join Code:    {s['join_code']}")
    print(f"Quiz URL:     http://127.0.0.1:8080/join?code={s['join_code']}")
    print("======================================================\n")


if __name__ == "__main__":
    main()
