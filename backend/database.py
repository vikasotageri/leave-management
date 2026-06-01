import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, String, JSON, DateTime, Boolean, Text
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime
import uuid

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./leaveflow.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def generate_id(prefix="L"):
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class Employee(Base):
    __tablename__ = "employees"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=False)
    plain_password = Column(String, nullable=True)
    role = Column(String, nullable=False, default="employee")
    phone = Column(String, default="")
    dob = Column(String, default="")
    doj = Column(String, default="")
    address = Column(String, default="")
    nationality = Column(String, default="")
    designation = Column(String, default="")
    project_tag = Column(String, nullable=True)
    manager_id = Column(String, nullable=True)
    gender = Column(String, default="")
    document = Column(Text, nullable=True)
    leave_balance = Column(JSON, default=lambda: {
        "sick": {"taken": 0, "limit": 12},
        "casual": {"taken": 0, "limit": 24},
        "business": {"taken": 0, "limit": 20},
        "emergency": {"taken": 0, "limit": 10},
        "family": {"taken": 0, "limit": 10},
        "paid": {"taken": 0, "limit": 100},
        "unpaid": {"taken": 0, "limit": 999},
        "totalAccrued": 0,
        "totalTaken": 0,
    })
    created_at = Column(DateTime, default=datetime.utcnow)


class LeaveRecord(Base):
    __tablename__ = "leave_records"

    id = Column(String, primary_key=True, index=True, default=lambda: generate_id("L"))
    employee_id = Column(String, nullable=False, index=True)
    employee_name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    start_date = Column(String, nullable=False)
    end_date = Column(String, nullable=False)
    reason = Column(Text, default="")
    document = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="pending")
    applied_on = Column(String, default=lambda: datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"))
    approved_by = Column(String, nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    notified_manager = Column(Boolean, default=False)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, index=True, default=lambda: generate_id("N"))
    user_id = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    message = Column(Text, default="")
    type = Column(String, default="in-app")
    to = Column(String, nullable=True)
    email = Column(String, nullable=True)
    read = Column(Boolean, default=False)
    created_at = Column(String, default=lambda: datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"))


class Holiday(Base):
    __tablename__ = "holidays"

    id = Column(String, primary_key=True, index=True, default=lambda: generate_id("H"))
    date = Column(String, nullable=False)
    name = Column(String, nullable=False)


Base.metadata.create_all(bind=engine)
