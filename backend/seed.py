"""
================================================================================
 LEAVE FLOW — Database Seeder
================================================================================

 PURPOSE:
  Seeds the database with initial data on first application startup.
  Creates the default HR and Manager accounts if they don't exist.

 CALLED BY:
  - backend/main.py line 25: seed_database() after table creation

 WHAT IT CREATES:
  - HR001 (hr@company.com / pass123) — Role: hr
  - MGR001 (manager@company.com / pass123) — Role: manager

 DESIGN NOTES:
  - Idempotent: checks if accounts exist before creating them
  - Uses get_or_create pattern to avoid duplicate seeding on restart
  - Plain password is stored alongside hashed for credential display to admin
================================================================================
"""

from database import SessionLocal, Employee
from auth import hash_password


def seed_database():
    """
    Main seeder function. Called once at app startup.
    Creates default HR and Manager accounts.
    Skips if accounts already exist (checked by email).
    """
    db = SessionLocal()
    try:
        # ---- Seed HR Account ----
        hr = db.query(Employee).filter(Employee.email == "hr@company.com").first()
        if not hr:
            hr = Employee(
                id="HR001",
                name="HR Admin",
                email="hr@company.com",
                password=hash_password("pass123"),
                plain_password="pass123",
                role="hr",
                phone="",
                designation="Human Resources",
            )
            db.add(hr)
            print("✅ Seeded HR001 (hr@company.com / pass123)")

        # ---- Seed Manager Account ----
        mgr = db.query(Employee).filter(Employee.email == "manager@company.com").first()
        if not mgr:
            mgr = Employee(
                id="MGR001",
                name="Team Manager",
                email="manager@company.com",
                password=hash_password("pass123"),
                plain_password="pass123",
                role="manager",
                phone="",
                designation="Senior Manager",
            )
            db.add(mgr)
            print("✅ Seeded MGR001 (manager@company.com / pass123)")

        db.commit()
    finally:
        db.close()
