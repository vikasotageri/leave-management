from database import SessionLocal, Employee, Holiday, generate_id
from auth import hash_password


def seed_database():
    db = SessionLocal()
    try:
        existing = db.query(Employee).count()
        if existing > 0:
            return

        hr = Employee(
            id="HR001",
            name="HR Manager",
            email="hr@company.com",
            password=hash_password("pass123"),
            role="hr",
            phone="+1-555-0100",
            dob="1985-03-15",
            doj="2023-01-01",
            address="100 Corporate Blvd, HQ",
            nationality="American",
            designation="HR Manager",
            project_tag=None,
            manager_id=None,
            gender="Female",
            leave_balance={
                "sick": {"taken": 0, "limit": 12},
                "casual": {"taken": 0, "limit": 24},
                "business": {"taken": 0, "limit": 20},
                "emergency": {"taken": 0, "limit": 10},
                "family": {"taken": 0, "limit": 10},
                "paid": {"taken": 0, "limit": 100},
                "unpaid": {"taken": 0, "limit": 999},
                "totalAccrued": 0,
                "totalTaken": 0,
            },
        )
        db.add(hr)

        mgr = Employee(
            id="MGR001",
            name="Manager User",
            email="manager@company.com",
            password=hash_password("pass123"),
            role="manager",
            phone="+1-555-0200",
            dob="1988-07-22",
            doj="2023-06-01",
            address="200 Executive Suite, Floor 3",
            nationality="American",
            designation="Project Manager",
            project_tag=None,
            manager_id=None,
            gender="Male",
            leave_balance={
                "sick": {"taken": 0, "limit": 12},
                "casual": {"taken": 0, "limit": 24},
                "business": {"taken": 0, "limit": 20},
                "emergency": {"taken": 0, "limit": 10},
                "family": {"taken": 0, "limit": 10},
                "paid": {"taken": 0, "limit": 100},
                "unpaid": {"taken": 0, "limit": 999},
                "totalAccrued": 0,
                "totalTaken": 0,
            },
        )
        db.add(mgr)

        holidays_data = [
            ("2026-01-01", "New Year"),
            ("2026-01-26", "Republic Day"),
            ("2026-03-25", "Holi"),
            ("2026-04-14", "Ambedkar Jayanti"),
            ("2026-05-01", "Labour Day"),
            ("2026-08-15", "Independence Day"),
            ("2026-10-02", "Gandhi Jayanti"),
            ("2026-10-22", "Diwali"),
            ("2026-11-14", "Children's Day"),
            ("2026-12-25", "Christmas"),
        ]
        for i, (date, name) in enumerate(holidays_data, 1):
            db.add(Holiday(id=f"H{i:03d}", date=date, name=name))

        db.commit()
    finally:
        db.close()
