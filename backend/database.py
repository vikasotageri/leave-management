"""
================================================================================
 LEAVE FLOW — Database Models & Engine Configuration
================================================================================

 PURPOSE:
  Defines all SQLAlchemy ORM models and the database engine connection.
  This is the single source of truth for the database schema.

 SYSTEM DESIGN:
  Uses SQLite by default (zero-config for development) with optional PostgreSQL
  support via DATABASE_URL env var. SQLAlchemy handles the ORM mapping,
  so all data access in the app goes through these model classes.

 TABLES:
  employees       → Employee accounts & profile data
  leave_records   → Leave applications, approvals, cancellations
  notifications   → In-app notification messages
  holidays        → Company holiday calendar

 CALLED BY:
  - backend/main.py             → Creates tables via Base.metadata.create_all()
  - backend/auth.py             → Queries Employee for authentication
  - backend/seed.py             → Inserts seed data
  - backend/routers/*.py        → All API endpoints use get_db() for sessions
  - ai/agents/tools.py          → All LangGraph tool functions query via Session
  - ai/engine/rag.py            → (Indirectly through tools)

 RELATIONSHIPS:
  Employee (1) ──→ (N) LeaveRecord   (employee_id foreign key)
  Employee (1) ──→ (N) Notification  (user_id)
  No foreign key constraints (SQLite-friendly, app-enforced logical FKs)

 LEAVE BALANCE JSON STRUCTURE (stored on Employee):
  {
    "sick":     {"taken": N, "limit": 12},
    "casual":   {"taken": N, "limit": 24},
    "business": {"taken": N, "limit": 20},
    "emergency":{"taken": N, "limit": 10},
    "family":   {"taken": N, "limit": 10},
    "paid":     {"taken": N, "limit": 100},
    "unpaid":   {"taken": N, "limit": 999},
    "totalAccrued": 0,
    "totalTaken": 0
  }

 NOTE:
  - leave_balance uses JSON column for flexibility (no separate balance table)
  - Documents (employee docs, leave attachments) are stored as base64 Text
  - Retry logic at the bottom handles race conditions during table creation
================================================================================
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, String, JSON, DateTime, Boolean, Text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.ext.hybrid import hybrid_property
from datetime import datetime
import uuid

load_dotenv()

# ---- Database Connection ----
# Supports SQLite (default) and PostgreSQL
# SQLite uses ./leaveflow.db relative to CWD
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./leaveflow.db")
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _parse_date_value(value: str | None):
    """Parse a stored date string in either YYYY-MM-DD or DD-MM-YYYY format."""
    if not value:
        return None
    raw = str(value).strip()[:10]
    for fmt in ("%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            pass
    return None


def generate_id(prefix="L"):
    """
    Generates unique IDs in format: {prefix}-{8 hex chars}
    Examples: L-4e4f1fe8, N-a3b2c1d0, H-ff001122
    Used across all tables for primary keys.
    """
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def get_db():
    """
    FastAPI dependency that yields a database session.
    Automatically closes the session after the request completes.
    Usage in routes:
        async def my_endpoint(db: Session = Depends(get_db)):
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =====================================================================
# EMPLOYEE MODEL
# =====================================================================
# Stores:
#   - Authentication credentials (hashed password + plain for creds display)
#   - Profile info (name, email, phone, DOJ, designation, gender)
#   - HR document (base64 PDF/upload)
#   - Project tag for manager grouping
#   - Leave balance as JSON blob
# =====================================================================
class Employee(Base):
    __tablename__ = "employees"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=False)          # bcrypt-hashed
    plain_password = Column(String, nullable=True)     # shown once after creation
    role = Column(String, nullable=False, default="employee")  # employee | manager | hr
    phone = Column(String, default="")
    dob = Column(String, default="")                   # Date of birth (DD-MM-YYYY)
    doj = Column(String, default="")                   # Date of joining (DD-MM-YYYY)
    address = Column(String, default="")
    nationality = Column(String, default="")
    designation = Column(String, default="")
    project_tag = Column(String, nullable=True)        # Ties employee to a project
    manager_id = Column(String, nullable=True)         # Logical FK to manager Employee.id
    gender = Column(String, default="")
    document = Column(Text, nullable=True)             # base64 encoded document
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

    @hybrid_property
    def is_tagged(self):
        """Backwards-compatible helper for older code paths."""
        return bool(self.project_tag)

    @is_tagged.expression
    def is_tagged(cls):
        return cls.project_tag.isnot(None)


# =====================================================================
# LEAVE RECORD MODEL
# =====================================================================
# Tracks every leave application through its lifecycle:
#   pending → approved (or rejected) → cancellation_requested → approved/rejected
# Stores reason, attached documents, and audit trail (applied_on, approved_by)
# =====================================================================
class LeaveRecord(Base):
    __tablename__ = "leave_records"

    id = Column(String, primary_key=True, index=True, default=lambda: generate_id("L"))
    employee_id = Column(String, nullable=False, index=True)
    employee_name = Column(String, nullable=False)
    type = Column(String, nullable=False)              # sick | casual | business | emergency | family | unpaid
    start_date = Column(String, nullable=False)        # DD-MM-YYYY or YYYY-MM-DD
    end_date = Column(String, nullable=False)
    reason = Column(Text, default="")
    document = Column(Text, nullable=True)             # base64 attachment for this leave
    status = Column(String, nullable=False, default="pending")
    applied_on = Column(String, default=lambda: datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"))
    approved_by = Column(String, nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    notified_manager = Column(Boolean, default=False)

    @hybrid_property
    def leave_type(self):
        """Backwards-compatible alias for the older schema."""
        return self.type

    @leave_type.expression
    def leave_type(cls):
        return cls.type

    @hybrid_property
    def no_of_days(self):
        """Compute leave duration from the stored start/end dates."""
        start = _parse_date_value(self.start_date)
        end = _parse_date_value(self.end_date)
        if start and end:
            return max(1, (end - start).days + 1)
        return 1

    @hybrid_property
    def is_auto_approved(self):
        return self.status == "auto-approved"

    @is_auto_approved.expression
    def is_auto_approved(cls):
        return cls.status == "auto-approved"

    @hybrid_property
    def cancellation_requested(self):
        return self.status == "cancellation_requested"

    @cancellation_requested.expression
    def cancellation_requested(cls):
        return cls.status == "cancellation_requested"

    @hybrid_property
    def cancellation_status(self):
        if self.status == "cancellation_requested":
            return "Pending review"
        if self.status == "approved":
            return "Approved"
        if self.status == "rejected":
            return "Rejected"
        return None


# =====================================================================
# NOTIFICATION MODEL
# =====================================================================
# In-app notifications for leave approvals, rejections, cancellations.
# Supports multiple types: leave_approved, leave_rejected, etc.
# Email notifications are sent via email_service.py (separate).
# =====================================================================
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, index=True, default=lambda: generate_id("N"))
    user_id = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    message = Column(Text, default="")
    type = Column(String, default="in-app")
    to = Column(String, nullable=True)                 # recipient role/email
    email = Column(String, nullable=True)
    read = Column(Boolean, default=False)
    created_at = Column(String, default=lambda: datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"))


# =====================================================================
# HOLIDAY MODEL
# =====================================================================
# Company holidays used for calendar display and leave calculations.
# Managed by HR through the calendar modal in the UI.
# =====================================================================
class Holiday(Base):
    __tablename__ = "holidays"

    id = Column(String, primary_key=True, index=True, default=lambda: generate_id("H"))
    date = Column(String, nullable=False)              # YYYY-MM-DD
    name = Column(String, nullable=False)              # Holiday name


# ---- Table Creation with Retry ----
# In concurrent startup scenarios (multiple server instances),
# SQLite can throw "database is locked". Retry 5 times with backoff.
import time
for attempt in range(5):
    try:
        Base.metadata.create_all(bind=engine)
        break
    except Exception:
        if attempt < 4:
            time.sleep(attempt + 1)
        else:
            raise
