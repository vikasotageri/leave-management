"""
================================================================================
 LEAVE FLOW — AI Agent Tools (Specialist Handlers + DB Functions)
================================================================================

 PURPOSE:
  Contains ALL tool functions used by the application:
    1. DB-level functions (with `db` param) — called by REST API routers
    2. Agent-level functions (with `message, user_id, role`) — called by LangGraph supervisor
    3. LangChain @tool wrappers — bound to GPT-4o-mini for function calling

 CALLED BY:
  - backend/routers/leaves.py: DB functions (apply_leave, approve_leave, etc.)
  - backend/routers/employees.py: DB functions (get_leave_balance, etc.)
  - ai/agents/supervisor.py: Agent-level functions (ask_leave_assistant, etc.)
  - ai/agents/graphs.py: @tool wrappers via call_agent_with_tools()

 DESIGN:
  Two function layers exist:
    DB layer:   get_leave_balance(db, emp_id), apply_leave(db, ...) — takes SQLAlchemy Session
    Agent layer: get_user_leaves(message, user_id, role) — calls DB layer internally
  The agent-layer functions parse natural language, validate, then delegate to DB functions.

 NAMING CONVENTION:
  _agent suffix = supervisor-agent function (called by LangGraph)
  no suffix     = DB-level function (called by REST routers)
  _wrapper      = @tool-decorated LangChain wrapper (called by LLM)
================================================================================
"""

import os
import re
import math
import json
from datetime import datetime, date, timedelta, timezone
from typing import List, Optional, Dict, Any, Tuple
from collections import defaultdict
from dateutil import parser as dateparser
from dotenv import load_dotenv
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session
from openai import OpenAI
from langchain_core.tools import tool

# Local imports
from database import SessionLocal, Employee, LeaveRecord, Notification, Holiday
from ai.engine.agent_memory import conversation_memory
from ai.engine.rag import RagPipeline

load_dotenv()

# Active chat context is injected by the supervisor before tool execution.
CURRENT_AI_CONTEXT = {"user_id": None, "role": None}


def set_ai_context(user_id: str | None, role: str | None):
    """Set the current chat context for role-safe tool execution."""
    CURRENT_AI_CONTEXT["user_id"] = user_id
    CURRENT_AI_CONTEXT["role"] = role


def _resolve_employee_scope(employee_id: str) -> str:
    """Force employee-only tools to operate on the logged-in employee."""
    if (CURRENT_AI_CONTEXT.get("role") or "").lower() == "employee":
        return CURRENT_AI_CONTEXT.get("user_id") or employee_id
    return employee_id

def _get_client():
    """Lazy OpenAI client (avoids eager credential check on import)."""
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

GPT_MODEL = "gpt-4o-mini"


# ======================================================================
# HELPER FUNCTIONS (date parsing, balance calculation)
# ======================================================================

def months_since(doj_str):
    """Calculate months elapsed since date of joining (used for casual leave accrual)."""
    if not doj_str:
        return 0
    try:
        try:
            doj = datetime.strptime(doj_str, "%d-%m-%Y")
        except ValueError:
            doj = datetime.strptime(doj_str, "%Y-%m-%d")
        now = datetime.now()
        return max(1, (now.year - doj.year) * 12 + (now.month - doj.month) + 1)
    except Exception:
        return 1


def parse_date_flexible(date_str):
    """Parse date in DD-MM-YYYY or YYYY-MM-DD format. Returns datetime or None."""
    if not date_str:
        return None
    date_str = date_str[:10]
    try:
        return datetime.strptime(date_str, "%d-%m-%Y")
    except ValueError:
        try:
            return datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            return None


# ======================================================================
# DB-LEVEL FUNCTIONS (called by REST API routers)
# ======================================================================

def get_leave_balance(db: Session, employee_id: str):
    """
    Compute leave balance for an employee.
    Only approved/auto-approved/cancellation_requested records count toward usage.
    Balance = max(0, limit - taken).

    Returns dict with remaining/limit for each leave type.
    """
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        return {"error": "Employee not found"}

    ms = months_since(emp.doj)
    now = datetime.now()

    taken_records = db.query(LeaveRecord).filter(
        LeaveRecord.employee_id == employee_id,
        LeaveRecord.status.in_(["approved", "auto-approved", "paid_leave", "cancellation_requested"])
    ).all()

    def days_used(recs):
        total = 0
        for r in recs:
            end = parse_date_flexible(r.end_date)
            start = parse_date_flexible(r.start_date)
            if start and end:
                total += max(1, (end - start).days + 1)
        return total

    year_recs = [r for r in taken_records if r.start_date and (parse_date_flexible(r.start_date) or datetime(1, 1, 1)).year == now.year]
    month_recs = [r for r in taken_records if r.start_date
                  and (parse_date_flexible(r.start_date) or datetime(1, 1, 1)).year == now.year
                  and (parse_date_flexible(r.start_date) or datetime(1, 1, 1)).month == now.month]

    casual_taken_all = days_used([r for r in taken_records if r.type == "casual"])
    sick_taken_all = days_used([r for r in taken_records if r.type == "sick"])
    business_taken_year = days_used([r for r in year_recs if r.type == "business"])
    emergency_taken_year = days_used([r for r in year_recs if r.type == "emergency"])
    emergency_taken_month = days_used([r for r in month_recs if r.type == "emergency"])
    family_taken_year = days_used([r for r in year_recs if r.type == "family"])
    paid_taken_all = days_used([r for r in taken_records if r.type == "paid"])
    unpaid_taken_all = days_used([r for r in taken_records if r.type == "unpaid"])

    casual_months = ms
    casual_max = casual_months * 2
    casual_remaining = max(0, casual_max - casual_taken_all)

    sick_taken_this_year = days_used([r for r in year_recs if r.type == "sick"])
    sick_remaining = max(0, 12 - sick_taken_this_year)
    business_remaining = max(0, 20 - business_taken_year)
    emergency_remaining = max(0, 10 - emergency_taken_year)
    family_remaining = max(0, 10 - family_taken_year)

    total_taken = casual_taken_all + sick_taken_all + business_taken_year + emergency_taken_year + family_taken_year + paid_taken_all + unpaid_taken_all

    return {
        "sick": {"remaining": sick_remaining, "limit": 12, "monthlyLimit": 1},
        "casual": {"remaining": casual_remaining, "limit": casual_max, "monthlyLimit": 2, "carriedForward": True},
        "business": {"remaining": business_remaining, "limit": 20, "autoApproved": False},
        "emergency": {"remaining": emergency_remaining, "limit": 10, "monthlyLimit": 1},
        "family": {"remaining": family_remaining, "limit": 10, "autoApproved": False},
        "paid": {"remaining": 100, "limit": 100},
        "unpaid": {"remaining": 999, "limit": 999, "autoApproved": False},
        "totalAccrued": casual_max + 12 + 20 + 10 + 10,
        "totalTaken": total_taken,
    }


def get_leave_history(db: Session, employee_id: str, limit: int = 200):
    """
    Get leave history for an employee (newest first).
    Auto-cancels stale pending leaves (>4 days old) before querying.
    """
    auto_cancel_stale_pending(db)
    records = db.query(LeaveRecord).filter(
        LeaveRecord.employee_id == employee_id
    ).order_by(LeaveRecord.applied_on.desc()).limit(limit).all()
    return [{"id": r.id, "employeeId": r.employee_id, "type": r.type,
             "start_date": r.start_date, "end_date": r.end_date,
             "status": r.status, "applied_on": r.applied_on, "reason": r.reason,
             "document": r.document,
             "cancellation_reason": r.cancellation_reason,
             "rejection_reason": r.rejection_reason} for r in records]


def get_upcoming_leaves(db: Session, employee_id: str):
    """
    Get upcoming leaves (approved / auto-approved / pending) for an employee.
    Auto-cancels stale pending leaves before querying.
    """
    auto_cancel_stale_pending(db)
    today = datetime.now().strftime("%Y-%m-%d")
    records = db.query(LeaveRecord).filter(
        LeaveRecord.employee_id == employee_id,
        LeaveRecord.start_date >= today,
        LeaveRecord.status.in_(["approved", "auto-approved", "pending", "cancellation_requested"])
    ).order_by(LeaveRecord.start_date).all()
    return [{"id": r.id, "type": r.type, "start_date": r.start_date,
             "end_date": r.end_date, "status": r.status} for r in records]


def get_employee_by_id(db: Session, employee_id: str):
    """
    Get full employee details including leave balance and document.
    Called by agent tools and REST endpoints.
    """
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        return {"error": "Employee not found"}
    return {
        "id": emp.id, "name": emp.name, "email": emp.email,
        "role": emp.role, "doj": emp.doj, "phone": emp.phone or "",
        "project_tag": emp.project_tag, "manager_id": emp.manager_id,
        "designation": emp.designation or "",
        "gender": emp.gender or "",
        "dob": emp.dob or "",
        "nationality": emp.nationality or "",
        "address": emp.address or "",
        "document": emp.document,
        "leave_balance": get_leave_balance(db, employee_id),
        "projectTag": emp.project_tag,
    }


def get_my_employee_profile(user_id: str):
    """Return a full self-only profile summary for the logged-in employee."""
    db = SessionLocal()
    try:
        emp = db.query(Employee).filter(Employee.id == _resolve_employee_scope(user_id)).first()
        if not emp:
            return "Employee not found."
        mgr = get_employee_info(emp.manager_id) if emp.manager_id else None
        lines = [
            f"Profile: {emp.name} ({emp.id})",
            f"Designation: {emp.designation or 'N/A'}",
            f"Project Tag: {emp.project_tag or 'Not tagged'}",
            f"Manager: {mgr.name if mgr else 'N/A'}",
            f"Email: {emp.email or 'N/A'}",
            f"Phone: {emp.phone or 'N/A'}",
            f"Gender: {emp.gender or 'N/A'}",
            f"DOB: {emp.dob or 'N/A'}",
            f"DOJ: {emp.doj or 'N/A'}",
            f"Nationality: {emp.nationality or 'N/A'}",
            f"Address: {emp.address or 'N/A'}",
        ]
        return "\n".join(lines)
    finally:
        db.close()


def get_all_employees(db: Session):
    """Get list of all employee accounts (role='employee')."""
    emps = db.query(Employee).filter(Employee.role == "employee").all()
    return [{"id": e.id, "name": e.name, "email": e.email,
             "role": e.role, "doj": e.doj, "gender": e.gender} for e in emps]


def auto_cancel_stale_pending(db: Session):
    """
    Auto-cancel pending leaves that are older than 4 days.
    Prevents accumulation of stale requests in the system.
    """
    cutoff = (datetime.now() - timedelta(days=4)).strftime("%Y-%m-%d %H:%M:%S")
    stale = db.query(LeaveRecord).filter(
        LeaveRecord.status == "pending",
        LeaveRecord.applied_on < cutoff,
    ).all()
    for rec in stale:
        db.delete(rec)
    if stale:
        db.commit()


def apply_leave(db: Session, employee_id: str, leave_type: str, start_date: str, end_date: str, reason: str, document: str = None):
    """
    Apply for a leave (date range).

    FLOW:
      1. Validate employee exists
      2. Parse/validate date range
      3. Check 70-day advance/retro limit
      4. Check remaining balance
      5. Check for duplicate overlapping leaves
      6. Apply auto-approval rules (casual/sick/emergency monthly limits)
      7. Tagged employees bypass auto-approval
      8. Create LeaveRecord + Notification
      9. Return result with status

    Auto-approval rules:
      - Casual: ≤2 requests/month AND ≤2 days → auto-approved
      - Sick: 1st request/month AND 1 day → auto-approved
      - Emergency: 1st request/month AND 1 day → auto-approved
      - Business/Family/Unpaid: always manager approval
      - Tagged employees: always manager approval
    """
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        return {"success": False, "error": "Employee not found"}

    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        try:
            start = datetime.strptime(start_date, "%d-%m-%Y")
            end = datetime.strptime(end_date, "%d-%m-%Y")
        except ValueError:
            return {"success": False, "error": f"Invalid date format. Use YYYY-MM-DD (got: {start_date})"}
    days = (end - start).days + 1

    now = datetime.now()
    if start > now + timedelta(days=70):
        return {"success": False, "error": "Cannot apply more than 70 days in advance"}
    if start.date() < (now - timedelta(days=70)).date():
        return {"success": False, "error": "Cannot apply for dates more than 70 days in the past"}

    leave_year = start.year
    leave_month = start.month
    ms = months_since(emp.doj)

    taken_records = db.query(LeaveRecord).filter(
        LeaveRecord.employee_id == employee_id,
        LeaveRecord.status.in_(["approved", "auto-approved", "paid_leave", "cancellation_requested"])
    ).all()

    def days_used(recs):
        total = 0
        for r in recs:
            end = parse_date_flexible(r.end_date)
            start = parse_date_flexible(r.start_date)
            if start and end:
                total += max(1, (end - start).days + 1)
        return total

    def count_recs(recs):
        return len(recs)

    year_recs = [r for r in taken_records if r.start_date and (parse_date_flexible(r.start_date) or datetime(1, 1, 1)).year == leave_year]
    month_recs = [r for r in taken_records if r.start_date
                  and (parse_date_flexible(r.start_date) or datetime(1, 1, 1)).year == leave_year
                  and (parse_date_flexible(r.start_date) or datetime(1, 1, 1)).month == leave_month]

    casual_taken_all = days_used([r for r in taken_records if r.type == "casual"])
    business_taken_year = days_used([r for r in year_recs if r.type == "business"])
    emergency_taken_year = days_used([r for r in year_recs if r.type == "emergency"])
    emergency_taken_month = days_used([r for r in month_recs if r.type == "emergency"])
    family_taken_year = days_used([r for r in year_recs if r.type == "family"])

    casual_max = ms * 2
    casual_remaining = max(0, casual_max - casual_taken_all)
    sick_taken_this_year = days_used([r for r in year_recs if r.type == "sick"])
    sick_remaining = max(0, 12 - sick_taken_this_year)
    business_remaining = max(0, 20 - business_taken_year)
    emergency_remaining = max(0, 10 - emergency_taken_year)
    family_remaining = max(0, 10 - family_taken_year)

    status = "pending"
    approved_by = None

    # Balance check
    if leave_type == "casual" and casual_remaining < days:
        return {"success": False, "error": f"Insufficient casual leave balance (need {days}, have {casual_remaining})"}
    if leave_type == "sick" and sick_remaining < days:
        return {"success": False, "error": f"Insufficient sick leave balance (need {days}, have {sick_remaining})"}
    if leave_type == "business" and business_remaining < days:
        return {"success": False, "error": f"Insufficient business leave balance (need {days}, have {business_remaining})"}
    if leave_type == "emergency" and emergency_remaining < days:
        return {"success": False, "error": f"Insufficient emergency leave balance (need {days}, have {emergency_remaining})"}
    if leave_type == "family" and family_remaining < days:
        return {"success": False, "error": f"Insufficient family leave balance (need {days}, have {family_remaining})"}

    # Duplicate check
    existing = db.query(LeaveRecord).filter(
        LeaveRecord.employee_id == employee_id,
        LeaveRecord.start_date <= end_date,
        LeaveRecord.end_date >= start_date,
        LeaveRecord.status.in_(["pending", "approved", "auto-approved", "cancellation_requested"])
    ).first()
    if existing:
        return {"success": False, "error": f"Already applied for {existing.type} leave on this date (Status: {existing.status})"}

    # Auto-approval rules
    if leave_type == "casual":
        casual_taken_month = count_recs([r for r in month_recs if r.type == "casual"])
        if casual_taken_month < 2 and days <= 2:
            status = "auto-approved"
            approved_by = "system"
    elif leave_type == "sick":
        sick_taken_month = count_recs([r for r in month_recs if r.type == "sick"])
        if sick_taken_month < 1 and days <= 1:
            status = "auto-approved"
            approved_by = "system"
    elif leave_type == "emergency":
        emergency_taken_month = count_recs([r for r in month_recs if r.type == "emergency"])
        if emergency_taken_month < 1 and days <= 1:
            status = "auto-approved"
            approved_by = "system"

    # Tagged employees: no auto-approval
    if emp.project_tag:
        status = "pending"
        approved_by = None

    new_leave = LeaveRecord(
        employee_id=employee_id,
        employee_name=emp.name,
        type=leave_type,
        start_date=start_date,
        end_date=end_date,
        reason=reason,
        document=document,
        status=status,
        applied_on=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        approved_by=approved_by,
    )
    db.add(new_leave)

    if status == "auto-approved":
        db.add(Notification(
            user_id=emp.manager_id or "MGR001",
            title=f"[Auto-Approval] {emp.name} - {leave_type} Leave",
            message=f"{emp.name} applied for {leave_type} leave ({start_date} to {end_date}). Auto-approved.",
            type="in-app",
        ))
    else:
        db.add(Notification(
            user_id=emp.manager_id or "MGR001",
            title=f"[Pending] {emp.name} - {leave_type} Leave",
            message=f"{emp.name} applied for {leave_type} leave ({start_date} to {end_date}). Needs review.",
            type="in-app",
        ))

    db.commit()
    return {"success": True, "leave_id": new_leave.id, "status": status}


def bulk_apply_leave(db: Session, employee_id: str, leave_type: str, dates: list, reason: str = "", document: str = None):
    """
    Apply for leave on multiple specific dates (each date is a separate record).

    Validates each date, checks balance, applies per-month auto-approval rules.
    If ANY date in the batch exceeds monthly limits, ALL go to pending.
    """
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        return {"success": False, "error": "Employee not found"}

    now = datetime.now()
    parsed = []
    for d in dates:
        dt = parse_date_flexible(d)
        if not dt:
            return {"success": False, "error": f"Invalid date format: {d}"}
        if dt > now + timedelta(days=70):
            return {"success": False, "error": "Cannot apply more than 70 days in advance"}
        if dt.date() < (now - timedelta(days=70)).date():
            return {"success": False, "error": "Cannot apply for dates more than 70 days in the past"}
        parsed.append(dt)

    duplicates = db.query(LeaveRecord).filter(
        LeaveRecord.employee_id == employee_id,
        LeaveRecord.start_date.in_(dates),
        LeaveRecord.status.in_(["pending", "approved", "auto-approved", "cancellation_requested"])
    ).all()
    if duplicates:
        dup = duplicates[0]
        return {"success": False, "error": f"Already applied for {dup.type} leave on {dup.start_date[:10]} (Status: {dup.status})"}

    taken_records = db.query(LeaveRecord).filter(
        LeaveRecord.employee_id == employee_id,
        LeaveRecord.status.in_(["approved", "auto-approved", "paid_leave", "cancellation_requested"])
    ).all()

    def days_used(recs):
        total = 0
        for r in recs:
            end = parse_date_flexible(r.end_date)
            start = parse_date_flexible(r.start_date)
            if start and end:
                total += max(1, (end - start).days + 1)
        return total

    dates_by_month = defaultdict(list)
    all_years = set()
    for d, dt in zip(dates, parsed):
        dates_by_month[(dt.year, dt.month)].append(d)
        all_years.add(dt.year)

    year_recs = [r for r in taken_records if r.start_date
                 and (parse_date_flexible(r.start_date) or datetime(1, 1, 1)).year in all_years]

    new_days = len(dates)

    ms = months_since(emp.doj)
    casual_taken_all = days_used([r for r in taken_records if r.type == "casual"])
    casual_max = ms * 2
    casual_remaining = max(0, casual_max - casual_taken_all)
    sick_taken_this_year = days_used([r for r in year_recs if r.type == "sick"])
    business_taken_year = days_used([r for r in year_recs if r.type == "business"])
    emergency_taken_year = days_used([r for r in year_recs if r.type == "emergency"])
    family_taken_year = days_used([r for r in year_recs if r.type == "family"])
    sick_remaining = max(0, 12 - sick_taken_this_year)
    business_remaining = max(0, 20 - business_taken_year)
    emergency_remaining = max(0, 10 - emergency_taken_year)
    family_remaining = max(0, 10 - family_taken_year)

    if leave_type == "casual" and casual_remaining < new_days:
        return {"success": False, "error": f"Insufficient casual leave balance (need {new_days}, have {casual_remaining})"}
    if leave_type == "sick" and sick_remaining < new_days:
        return {"success": False, "error": f"Insufficient sick leave balance (need {new_days}, have {sick_remaining})"}
    if leave_type == "business" and business_remaining < new_days:
        return {"success": False, "error": f"Insufficient business leave balance (need {new_days}, have {business_remaining})"}
    if leave_type == "emergency" and emergency_remaining < new_days:
        return {"success": False, "error": f"Insufficient emergency leave balance (need {new_days}, have {emergency_remaining})"}
    if leave_type == "family" and family_remaining < new_days:
        return {"success": False, "error": f"Insufficient family leave balance (need {new_days}, have {family_remaining})"}

    monthly_limit = {"casual": 2, "sick": 1, "emergency": 1}.get(leave_type, 0)
    at_a_time_limit = {"casual": 2, "sick": 1, "emergency": 1}.get(leave_type, 999)

    status = "pending"
    approved_by = None

    if monthly_limit > 0:
        can_auto_approve = True
        for (yr, mo), month_dates in dates_by_month.items():
            existing_in_month = len([r for r in taken_records if r.type == leave_type
                                     and r.start_date
                                     and (parse_date_flexible(r.start_date) or datetime(1, 1, 1)).year == yr
                                     and (parse_date_flexible(r.start_date) or datetime(1, 1, 1)).month == mo])
            new_in_month = len(month_dates)
            if existing_in_month + 1 > monthly_limit or new_in_month > at_a_time_limit:
                can_auto_approve = False
                break
        if can_auto_approve:
            status = "auto-approved"
            approved_by = "system"

    if emp.project_tag:
        status = "pending"
        approved_by = None

    created = []
    for d in dates:
        rec = LeaveRecord(
            employee_id=employee_id,
            employee_name=emp.name,
            type=leave_type,
            start_date=d,
            end_date=d,
            reason=reason,
            document=document,
            status=status,
            applied_on=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            approved_by=approved_by,
        )
        db.add(rec)
        db.flush()
        created.append({"id": rec.id, "date": d, "status": status})

    if status == "auto-approved":
        db.add(Notification(
            user_id=emp.manager_id or "MGR001",
            title=f"[Auto-Approval] {emp.name} - {leave_type} Leave ({len(dates)} days)",
            message=f"{emp.name} applied for {leave_type} leave on {len(dates)} date(s). Auto-approved.",
            type="in-app",
        ))
    else:
        db.add(Notification(
            user_id=emp.manager_id or "MGR001",
            title=f"[Pending] {emp.name} - {leave_type} Leave ({len(dates)} days)",
            message=f"{emp.name} applied for {leave_type} leave on {len(dates)} date(s). Needs review.",
            type="in-app",
        ))

    db.commit()
    return {"success": True, "status": status, "leaves": created}


def cancel_leave(db: Session, leave_id: str, reason: str):
    """
    Cancel a leave request.

    Rules:
      - If leave is pending/rejected → hard delete from history
      - If leave is approved → change status to 'cancellation_requested' + record reason
      - If leave is already cancellation_requested → revert to approved (withdraw)
      - Leaves older than 70 days cannot be cancelled
    """
    leave = db.query(LeaveRecord).filter(LeaveRecord.id == leave_id).first()
    if not leave:
        return {"success": False, "error": "Leave not found"}

    leave_date = parse_date_flexible(leave.start_date)
    if (datetime.now() - leave_date).days > 70:
        return {"success": False, "error": "Cannot cancel leave older than 70 days"}

    if leave.status in ("pending", "rejected"):
        db.delete(leave)
        db.commit()
        return {"success": True, "auto_cancelled": True}

    if leave.status == "cancellation_requested":
        leave.status = "approved"
        leave.cancellation_reason = None
        db.commit()
        return {"success": True, "reverted": True}

    leave.status = "cancellation_requested"
    leave.cancellation_reason = reason
    db.commit()
    return {"success": True}


def approve_leave(db: Session, leave_id: str, approver_id: str = "MGR001"):
    """
    Approve a pending leave request (DB level).
    Called by REST endpoint and agent tool wrapper.
    """
    leave = db.query(LeaveRecord).filter(LeaveRecord.id == leave_id).first()
    if not leave:
        return {"success": False, "error": "Leave not found"}
    leave.status = "approved"
    leave.approved_by = approver_id
    leave.notified_manager = True
    db.commit()
    return {"success": True}


def reject_leave(db: Session, leave_id: str, reason: str):
    """
    Reject a pending leave request with reason (DB level).
    Called by REST endpoint and agent tool wrapper.
    """
    leave = db.query(LeaveRecord).filter(LeaveRecord.id == leave_id).first()
    if not leave:
        return {"success": False, "error": "Leave not found"}
    leave.status = "rejected"
    leave.rejection_reason = reason
    leave.notified_manager = True
    db.commit()
    return {"success": True}


def approve_cancellation(db: Session, leave_id: str):
    """
    Approve a cancellation request → hard delete the leave record.
    Balance is auto-restored by dynamic computation in get_leave_balance().
    """
    leave = db.query(LeaveRecord).filter(LeaveRecord.id == leave_id).first()
    if not leave:
        return {"success": False, "error": "Leave not found"}
    db.delete(leave)
    db.commit()
    return {"success": True}


def reject_cancellation(db: Session, leave_id: str, reason: str = ""):
    """
    Reject a cancellation request → keep leave as approved.
    """
    leave = db.query(LeaveRecord).filter(LeaveRecord.id == leave_id).first()
    if not leave:
        return {"success": False, "error": "Leave not found"}
    leave.status = "approved"
    leave.rejection_reason = reason
    db.commit()
    return {"success": True}


def get_leave_by_id(db: Session, leave_id: str):
    """Get full details of a specific leave by its ID."""
    leave = db.query(LeaveRecord).filter(LeaveRecord.id == leave_id).first()
    if not leave:
        return {"success": False, "error": "Leave not found"}
    emp = db.query(Employee).filter(Employee.id == leave.employee_id).first()
    return {
        "success": True,
        "leave": {
            "id": leave.id,
            "employeeId": leave.employee_id,
            "employeeName": leave.employee_name,
            "type": leave.type,
            "start_date": leave.start_date,
            "end_date": leave.end_date,
            "status": leave.status,
            "applied_on": leave.applied_on,
            "reason": leave.reason,
            "cancellation_reason": leave.cancellation_reason,
            "rejection_reason": leave.rejection_reason,
            "document": leave.document,
        }
    }


def get_pending_requests(db: Session, manager_id: str):
    """
    Get all pending leave requests for a manager's team.
    Auto-cancels stale pending leaves first.
    """
    auto_cancel_stale_pending(db)
    team = db.query(Employee).filter(Employee.manager_id == manager_id).all()
    team_ids = [t.id for t in team]
    records = db.query(LeaveRecord).filter(
        LeaveRecord.employee_id.in_(team_ids),
        LeaveRecord.status.in_(["pending"]),
    ).all()
    return [{"id": r.id, "employee_id": r.employee_id, "employee_name": r.employee_name,
             "type": r.type, "start_date": r.start_date, "end_date": r.end_date,
             "reason": r.reason, "applied_on": r.applied_on} for r in records]


def get_cancellation_requests(db: Session, manager_id: str):
    """
    Get all cancellation requests for a manager's team.
    """
    team = db.query(Employee).filter(Employee.manager_id == manager_id).all()
    team_ids = [t.id for t in team]
    records = db.query(LeaveRecord).filter(
        LeaveRecord.employee_id.in_(team_ids),
        LeaveRecord.status == "cancellation_requested",
    ).all()
    return [{"id": r.id, "employee_id": r.employee_id, "employee_name": r.employee_name,
             "type": r.type, "start_date": r.start_date, "end_date": r.end_date,
             "cancellation_reason": r.cancellation_reason} for r in records]


def get_team_leaves(db: Session, manager_id: str):
    """
    Get all approved leaves for a manager's team.
    """
    auto_cancel_stale_pending(db)
    team = db.query(Employee).filter(Employee.manager_id == manager_id).all()
    team_ids = [t.id for t in team]
    records = db.query(LeaveRecord).filter(
        LeaveRecord.employee_id.in_(team_ids),
        LeaveRecord.status.in_(["approved", "auto-approved"]),
    ).all()
    return [{"id": r.id, "employee_id": r.employee_id, "employee_name": r.employee_name,
             "type": r.type, "start_date": r.start_date, "end_date": r.end_date,
             "status": r.status} for r in records]


def get_team_leave_stats(db: Session, manager_id: str, period: str = "all"):
    """
    Get leave statistics for a manager's team over a given period.
    period: "all", "today", "week", "month"
    """
    team = db.query(Employee).filter(Employee.manager_id == manager_id).all()
    team_ids = [t.id for t in team]
    records = db.query(LeaveRecord).filter(
        LeaveRecord.employee_id.in_(team_ids),
    ).all()

    now = datetime.now()
    if period == "today":
        today = now.strftime("%Y-%m-%d")
        records = [r for r in records if r.applied_on and r.applied_on.startswith(today)]
    elif period == "week":
        week_ago = now - timedelta(days=7)
        records = [r for r in records if r.applied_on and datetime.strptime(r.applied_on[:10], "%Y-%m-%d") >= week_ago]
    elif period == "month":
        month_ago = now - timedelta(days=30)
        records = [r for r in records if r.applied_on and datetime.strptime(r.applied_on[:10], "%Y-%m-%d") >= month_ago]

    return {
        "total": len(records),
        "approved": len([r for r in records if r.status in ("approved", "auto-approved")]),
        "rejected": len([r for r in records if r.status == "rejected"]),
        "pending": len([r for r in records if r.status == "pending"]),
        "by_type": {
            "sick": len([r for r in records if r.type == "sick"]),
            "casual": len([r for r in records if r.type == "casual"]),
            "emergency": len([r for r in records if r.type == "emergency"]),
            "unpaid": len([r for r in records if r.type == "unpaid"]),
        },
    }


def check_team_availability(db: Session, manager_id: str, date: str):
    """
    Check how many team members are available on a given date.
    Returns total team size, on_leave count, and available count.
    """
    team = db.query(Employee).filter(Employee.manager_id == manager_id).all()
    team_ids = [t.id for t in team]
    on_leave = db.query(LeaveRecord).filter(
        LeaveRecord.employee_id.in_(team_ids),
        LeaveRecord.status.in_(["approved", "auto-approved"]),
        LeaveRecord.start_date <= date,
        LeaveRecord.end_date >= date,
    ).all()
    return {
        "total": len(team),
        "on_leave": len(on_leave),
        "available": len(team) - len(on_leave),
    }


def get_hr_contact(db: Session):
    """Get HR contact information (first HR user found)."""
    hr = db.query(Employee).filter(Employee.role == "hr").first()
    if not hr:
        return {"error": "No HR found"}
    return {"id": hr.id, "name": hr.name, "email": hr.email}


def get_manager_info(db: Session, employee_id: str):
    """Get manager info for an employee."""
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp or not emp.manager_id:
        return {"error": "No manager assigned"}
    mgr = db.query(Employee).filter(Employee.id == emp.manager_id).first()
    if not mgr:
        return {"error": "Manager not found"}
    return {"id": mgr.id, "name": mgr.name, "email": mgr.email}


# ======================================================================
# AGENT-LEVEL HELPER FUNCTIONS (shared across supervisor tools)
# ======================================================================

def get_leave_balance_details(user_id: str) -> str:
    """
    Calculate and format leave balance for a given employee.
    Returns a human-readable string for the AI agent response.
    """
    db = SessionLocal()
    try:
        emp = db.query(Employee).filter(Employee.id == user_id).first()
        if not emp:
            return "Employee not found."

        max_days = {
            "casual": 24, "sick": 12, "business": 20,
            "emergency": 10, "family": 10,
        }

        totals = {"casual": 0, "sick": 0, "business": 0, "emergency": 0, "family": 0}

        records = db.query(LeaveRecord).filter(
            LeaveRecord.employee_id == user_id,
            LeaveRecord.status.in_(["approved", "pending"])
        ).all()

        for r in records:
            lt = r.leave_type.lower()
            if lt in totals:
                days = r.no_of_days or 1
                totals[lt] += days

        parts = []
        for lt in ["sick", "casual", "business", "emergency", "family"]:
            taken = totals.get(lt, 0)
            max_d = max_days.get(lt, 10)
            parts.append(f"{lt.title()} {max_d - taken}/{max_d}")
        return f"Balance for {emp.name} ({user_id}): " + ", ".join(parts)
    finally:
        db.close()


def get_employee_info(user_id: str) -> Optional[Employee]:
    """Fetch employee from DB by ID. Returns Employee object or None."""
    db = SessionLocal()
    try:
        return db.query(Employee).filter(Employee.id == user_id).first()
    finally:
        db.close()


def get_user_role(user_id: str) -> str:
    """Get role string for a given user ID."""
    emp = get_employee_info(user_id)
    return emp.role if emp else "employee"


def parse_leave_date(message: str) -> Optional[date]:
    """Extract a date from natural language text."""
    try:
        return dateparser.parse(message, fuzzy=True).date()
    except Exception:
        return None


def parse_leave_dates(message: str) -> Tuple[Optional[date], Optional[date]]:
    """Extract start/end dates from a leave-related message."""
    range_match = re.search(r'from\s+(\S+)\s+to\s+(\S+)', message, re.IGNORECASE)
    if range_match:
        start = parse_leave_date(range_match.group(1))
        end = parse_leave_date(range_match.group(2))
        return start, end
    simple_range = re.search(r'(\S+)\s+to\s+(\S+)', message, re.IGNORECASE)
    if simple_range:
        start = parse_leave_date(simple_range.group(1))
        end = parse_leave_date(simple_range.group(2))
        if start and end:
            return start, end
    single = parse_leave_date(message)
    return single, single


def parse_leave_type(message: str) -> Optional[str]:
    """Extract leave type keyword from message text."""
    msg_lower = message.lower()
    types = {
        "casual": ["casual", "casual leave", "cl"],
        "sick": ["sick", "sick leave", "sl", "medical", "health"],
        "business": ["business", "business leave", "bl", "work", "official"],
        "emergency": ["emergency", "personal leave", "personal", "urgent"],
        "family": ["family", "vacation", "holiday", "family leave"],
        "unpaid": ["unpaid", "unpaid leave", "ul", "leave without pay"],
    }
    for leave_type, keywords in types.items():
        for kw in keywords:
            if kw in msg_lower:
                return leave_type
    return None


def parse_datetime_flexible(value: str | None) -> Optional[datetime]:
    """Parse stored datetime strings used by leave records."""
    if not value:
        return None
    raw = str(value).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d-%m-%Y %H:%M:%S", "%d-%m-%Y"):
        try:
            return datetime.strptime(raw[:len(fmt)], fmt)
        except ValueError:
            continue
    try:
        parsed = dateparser.parse(raw)
        return parsed if isinstance(parsed, datetime) else None
    except Exception:
        return None


def _format_count_map(counts: Dict[str, int], order: list[str]) -> str:
    parts = []
    for key in order:
        if counts.get(key, 0) > 0:
            parts.append(f"{key.title()}: {counts[key]}")
    extras = sorted(k for k in counts.keys() if k not in order and counts[k] > 0)
    parts.extend(f"{k.title()}: {counts[k]}" for k in extras)
    return ", ".join(parts) if parts else "None"


def get_employee_leave_summary_details(user_id: str) -> str:
    """Build a week/month leave summary for an employee."""
    db = SessionLocal()
    try:
        emp = db.query(Employee).filter(Employee.id == user_id).first()
        if not emp:
            return "Employee not found."

        now = datetime.now()
        week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        records = db.query(LeaveRecord).filter(LeaveRecord.employee_id == user_id).order_by(LeaveRecord.applied_on.desc()).all()

        def applied_at(rec):
            return parse_datetime_flexible(rec.applied_on) or parse_datetime_flexible(rec.start_date)

        def count_types(items):
            counts: Dict[str, int] = defaultdict(int)
            for rec in items:
                counts[(rec.type or "unknown").lower()] += 1
            return counts

        def count_statuses(items):
            counts: Dict[str, int] = defaultdict(int)
            for rec in items:
                counts[(rec.status or "unknown").lower()] += 1
            return counts

        week_records = []
        month_records = []
        for rec in records:
            dt = applied_at(rec)
            if not dt:
                continue
            if week_start <= dt <= now:
                week_records.append(rec)
            if month_start <= dt <= now:
                month_records.append(rec)

        week_types = count_types(week_records)
        month_types = count_types(month_records)
        week_status = count_statuses(week_records)
        month_status = count_statuses(month_records)
        overall_status = count_statuses(records)

        lines = [f"Summary for {emp.name} ({emp.id})"]
        lines.append(f"Project Tag: {emp.project_tag or 'Not tagged'}")
        if emp.manager_id:
            mgr = get_employee_info(emp.manager_id)
            if mgr:
                lines.append(f"• Manager: {mgr.name} ({mgr.id})")
        lines.append(
            f"This week: {len(week_records)} | { _format_count_map(week_types, ['casual', 'sick', 'business', 'emergency', 'family', 'unpaid']) } | "
            f"Pending {week_status.get('pending', 0)}, Approved {week_status.get('approved', 0) + week_status.get('auto-approved', 0)}, Rejected {week_status.get('rejected', 0)}"
        )
        lines.append(
            f"This month: {len(month_records)} | { _format_count_map(month_types, ['casual', 'sick', 'business', 'emergency', 'family', 'unpaid']) } | "
            f"Pending {month_status.get('pending', 0)}, Approved {month_status.get('approved', 0) + month_status.get('auto-approved', 0)}, Rejected {month_status.get('rejected', 0)}"
        )
        lines.append(
            f"Overall: Pending {overall_status.get('pending', 0)}, Approved {overall_status.get('approved', 0) + overall_status.get('auto-approved', 0)}, Rejected {overall_status.get('rejected', 0)}, Cancel Req {overall_status.get('cancellation_requested', 0)}"
        )
        if records:
            latest = records[0]
            lines.append(f"Latest: {latest.type.title()} {latest.start_date} to {latest.end_date} ({latest.status})")
        else:
            lines.append("Latest: none")
        return "\n".join(lines)
    finally:
        db.close()


def check_if_tagged(user_id: str) -> bool:
    """Check if an employee is tagged to a project (requires manager approval for all leaves)."""
    emp = get_employee_info(user_id)
    return bool(emp and emp.project_tag)


def calculate_working_days(start_date: date, end_date: date) -> int:
    """Calculate weekdays between two dates (inclusive)."""
    days = 0
    current = start_date
    while current <= end_date:
        if current.weekday() < 5:
            days += 1
        current += timedelta(days=1)
    return days


def get_current_leave_limits(leave_type: str) -> Dict[str, Any]:
    """Get policy limits for a given leave type."""
    limits = {
        "casual": {
            "max_per_year": 24, "auto_approve": True,
            "auto_approve_count": 2, "max_auto_days": 2,
            "carry_forward": True, "requires_approval_if_tagged": True,
        },
        "sick": {
            "max_per_year": 12, "auto_approve": True,
            "auto_approve_count": 1, "max_auto_days": 1,
            "carry_forward": False, "requires_approval_if_tagged": True,
        },
        "business": {
            "max_per_year": 20, "auto_approve": False,
            "auto_approve_count": 0, "max_auto_days": 0,
            "carry_forward": False, "requires_approval_if_tagged": True,
        },
        "emergency": {
            "max_per_year": 10, "auto_approve": True,
            "auto_approve_count": 1, "max_auto_days": 1,
            "carry_forward": False, "requires_approval_if_tagged": True,
        },
        "family": {
            "max_per_year": 10, "auto_approve": False,
            "auto_approve_count": 0, "max_auto_days": 0,
            "carry_forward": False, "requires_approval_if_tagged": True,
        },
        "unpaid": {
            "max_per_year": 999, "auto_approve": False,
            "auto_approve_count": 0, "max_auto_days": 0,
            "carry_forward": False, "requires_approval_if_tagged": False,
        },
    }
    return limits.get(leave_type, {})


def get_auto_approve_status(emp_id: str, leave_type: str, no_of_days: int) -> Tuple[bool, str]:
    """Determine if a leave should be auto-approved or requires manager approval."""
    emp = get_employee_info(emp_id)
    if not emp:
        return False, "Employee not found"
    if emp.is_tagged:
        return False, "Tagged employees require manager approval"
    limits = get_current_leave_limits(leave_type)
    if not limits:
        return False, "Unknown leave type"
    if leave_type == "unpaid":
        return False, "Unpaid leave requires manager approval"
    if not limits["auto_approve"]:
        return False, f"{leave_type.title()} leave requires manager approval"
    max_auto_days = limits.get("max_auto_days", 0)
    if no_of_days > max_auto_days:
        return False, f"Leave exceeds the maximum auto-approved days ({max_auto_days})"

    today = date.today()
    month_start = today.replace(day=1)
    db = SessionLocal()
    try:
        month_start_str = month_start.strftime("%Y-%m-%d 00:00:00")
        monthly_count = db.query(LeaveRecord).filter(
            LeaveRecord.employee_id == emp_id,
            LeaveRecord.leave_type == leave_type,
            LeaveRecord.status == "approved",
            LeaveRecord.is_auto_approved == True,
            LeaveRecord.applied_on >= month_start_str,
        ).count()
        if monthly_count >= limits.get("auto_approve_count", 0):
            return False, "Monthly auto-approve limit reached, manager approval required"
    finally:
        db.close()
    return True, "Auto-approved"


# ======================================================================
# SUPERVISOR-AGENT TOOLS (called by LangGraph supervisor)
# ======================================================================

def ask_leave_assistant(message: str, user_id: str, role: str) -> str:
    """
    Agent tool: Apply for leave via natural language.
    Parses leave type, dates, reason from message and creates leave record.
    """
    leave_type = parse_leave_type(message)
    start_date, end_date = parse_leave_dates(message)

    if not leave_type:
        return "Which type of leave do you want to apply for? (casual, sick, business, emergency, family, or unpaid)"
    if not start_date:
        return "Please specify a date for your leave."

    end = end_date or start_date
    days = calculate_working_days(start_date, end)
    if days < 1:
        days = 1

    reason = ""
    reason_match = re.search(r'for\s+(.+?)$', message, re.IGNORECASE)
    if reason_match:
        reason = reason_match.group(1).strip()

    if not reason:
        return f"Please provide a reason for your {leave_type} leave on {start_date}."

    emp = get_employee_info(user_id)
    if not emp:
        return "Employee not found."

    db = SessionLocal()
    try:
        max_days = get_current_leave_limits(leave_type).get("max_per_year", 10)
        taken = 0
        recs = db.query(LeaveRecord).filter(
            LeaveRecord.employee_id == user_id,
            LeaveRecord.leave_type == leave_type,
            LeaveRecord.status != "cancelled"
        ).all()
        for r in recs:
            taken += r.no_of_days or 1
        remaining = max_days - taken

        if remaining < days and leave_type != "unpaid":
            return f"Insufficient {leave_type} leave balance. You have {remaining} days remaining but requested {days}."

        auto_approved, status_msg = get_auto_approve_status(user_id, leave_type, days)
        status = "approved" if auto_approved else "pending"

        leave = LeaveRecord(
            employee_id=user_id,
            leave_type=leave_type,
            start_date=start_date,
            end_date=end,
            no_of_days=days,
            reason=reason,
            status=status,
            is_auto_approved=auto_approved,
        )
        db.add(leave)
        db.flush()

        try:
            manager = db.query(Employee).filter(Employee.role == "manager").first()
            if manager:
                db.add(Notification(
                    emp_id=manager.id,
                    message=f"{emp.name} applied for {leave_type} leave ({start_date} to {end})",
                    type="leave_request",
                ))
        except Exception:
            pass

        try:
            hr = db.query(Employee).filter(Employee.role == "hr").first()
            if hr:
                db.add(Notification(
                    emp_id=hr.id,
                    message=f"{emp.name} applied for {leave_type} leave ({start_date} to {end})",
                    type="leave_request",
                ))
        except Exception:
            pass

        db.commit()

        if auto_approved:
            return f"✅ {leave_type.title()} leave from {start_date} to {end} ({days} days) has been auto-approved!\nReason: {reason}"
        return f"📋 {leave_type.title()} leave from {start_date} to {end} ({days} days) has been submitted for manager approval.\nReason: {reason}\nNote: {status_msg}"
    finally:
        db.close()


def get_user_leaves(message: str, user_id: str, role: str) -> str:
    """
    Agent tool: Get leave balance + status for the user.
    Managers/HR get additional org-wide summaries.
    """
    balance = get_leave_balance_details(user_id)
    summary = get_employee_leave_summary_details(user_id)
    result = balance + "\n\n" + summary + "\n\n"

    db = SessionLocal()
    try:
        pending = db.query(LeaveRecord).filter(
            LeaveRecord.employee_id == user_id,
            LeaveRecord.status == "pending"
        ).count()
        approved = db.query(LeaveRecord).filter(
            LeaveRecord.employee_id == user_id,
            LeaveRecord.status == "approved"
        ).count()
        rejected = db.query(LeaveRecord).filter(
            LeaveRecord.employee_id == user_id,
            LeaveRecord.status == "rejected"
        ).count()
        cancellations = db.query(LeaveRecord).filter(
            LeaveRecord.employee_id == user_id,
            LeaveRecord.status == "cancellation_requested"
        ).count()
        result += (
            f"📋 Request counts:\n"
            f"• Pending leaves: {pending}\n"
            f"• Approved leaves: {approved}\n"
            f"• Rejected leaves: {rejected}\n"
            f"• Cancellation requests: {cancellations}"
        )

        if role == "manager":
            team_pending = db.query(LeaveRecord).join(
                Employee, LeaveRecord.employee_id == Employee.id
            ).filter(
                Employee.manager_id == user_id,
                LeaveRecord.status == "pending"
            ).count()
            result += f"\n👥 Team pending approvals: {team_pending}"

        if role == "hr":
            all_pending = db.query(LeaveRecord).filter(
                LeaveRecord.status == "pending"
            ).count()
            result += f"\n🏢 Total pending leaves in organization: {all_pending}"
    finally:
        db.close()

    return result


def payroll_query(message: str, user_id: str, role: str) -> str:
    """Agent tool: Answer payroll-related questions."""
    response = _get_client().chat.completions.create(
        model=GPT_MODEL,
        messages=[
            {"role": "system", "content": "You are a payroll assistant. Answer payroll-related questions concisely."},
            {"role": "user", "content": message}
        ],
        temperature=0.3,
        max_tokens=300,
    )
    return response.choices[0].message.content or "I couldn't process your payroll query."


def get_policy_answer(message: str, user_id: str, role: str) -> str:
    """Agent tool: Answer leave policy questions using RAG (ChromaDB)."""
    try:
        rag = RagPipeline()
        result = rag.query(message)
        if result.get("source_documents"):
            return result["answer"]
    except Exception:
        pass
    try:
        response = _get_client().chat.completions.create(
            model=GPT_MODEL,
            messages=[
                {"role": "system", "content": "You are a leave policy expert. Answer based on standard leave policies."},
                {"role": "user", "content": message}
            ],
            temperature=0.3,
            max_tokens=400,
        )
        return response.choices[0].message.content or "I couldn't find that policy."
    except Exception:
        return "Policy knowledge base is currently unavailable. Please contact HR."


def get_pending_leaves(message: str, user_id: str, role: str) -> str:
    """Agent tool: Get pending leave requests (manager views team, HR views all)."""
    db = SessionLocal()
    try:
        query = db.query(LeaveRecord, Employee).join(
            Employee, LeaveRecord.employee_id == Employee.id
        ).filter(LeaveRecord.status == "pending")

        if role == "manager":
            query = query.filter(Employee.manager_id == user_id)

        records = query.order_by(LeaveRecord.applied_on.desc()).limit(10).all()

        if not records:
            return "No pending leave requests at this time."

        lines = ["📋 Pending Leave Requests:"]
        for rec, emp in records:
            lines.append(
                f"• {emp.name} ({emp.id}): {rec.leave_type.title()} "
                f"from {rec.start_date} to {rec.end_date} "
                f"({rec.no_of_days} days) — Reason: {rec.reason}"
            )
        lines.append("\nTo approve: 'approve {employee_id}'")
        lines.append("To reject: 'reject {employee_id} with reason: ...'")

        return "\n".join(lines)
    finally:
        db.close()


def approve_leave_agent(message: str, user_id: str, role: str) -> str:
    """
    Agent tool: Approve a leave via chat message.
    Parses message for employee ID, validates authorization, approves.
    """
    id_match = re.search(r'(?:approve|approve\s+leave\s+for)\s+(EMP\d+)', message, re.IGNORECASE)
    if not id_match:
        return "Please specify which employee to approve. Example: 'approve EMP003'"

    target_id = id_match.group(1)

    if role not in ["manager", "hr"]:
        return "Only managers and HR can approve leaves."

    db = SessionLocal()
    try:
        leave = db.query(LeaveRecord).filter(
            LeaveRecord.employee_id == target_id,
            LeaveRecord.status == "pending"
        ).order_by(LeaveRecord.applied_on.desc()).first()

        if not leave:
            leave = db.query(LeaveRecord).filter(
                LeaveRecord.employee_id == target_id
            ).order_by(LeaveRecord.applied_on.desc()).first()
            if leave:
                return f"Leave for {target_id} is already {leave.status}."
            return f"No leave found for employee {target_id}."

        if role == "manager":
            emp = db.query(Employee).filter(Employee.id == target_id).first()
            if not emp or emp.manager_id != user_id:
                return "You can only approve leaves for employees assigned to you."

        leave.status = "approved"
        notif = Notification(
            emp_id=target_id,
            message=f"Your {leave.leave_type} leave ({leave.start_date} to {leave.end_date}) has been approved.",
            type="leave_approved",
        )
        db.add(notif)
        db.commit()

        emp = db.query(Employee).filter(Employee.id == target_id).first()
        emp_name = emp.name if emp else target_id
        return f"✅ Approved {leave.leave_type} leave for {emp_name} ({leave.start_date} to {leave.end_date})."
    finally:
        db.close()


def reject_leave_agent(message: str, user_id: str, role: str) -> str:
    """
    Agent tool: Reject a leave via chat message.
    Parses message for employee ID + reason, validates authorization, rejects.
    """
    id_match = re.search(r'(?:reject|reject\s+leave\s+for)\s+(EMP\d+)', message, re.IGNORECASE)
    if not id_match:
        return "Please specify which employee to reject. Example: 'reject EMP003'"

    target_id = id_match.group(1)

    if role not in ["manager", "hr"]:
        return "Only managers and HR can reject leaves."

    reason = "Declined by manager"
    reason_match = re.search(r'reason:\s*(.+?)$', message, re.IGNORECASE)
    if reason_match:
        reason = reason_match.group(1).strip()

    db = SessionLocal()
    try:
        leave = db.query(LeaveRecord).filter(
            LeaveRecord.employee_id == target_id,
            LeaveRecord.status == "pending"
        ).order_by(LeaveRecord.applied_on.desc()).first()

        if not leave:
            return f"No pending leave found for employee {target_id}."

        if role == "manager":
            emp = db.query(Employee).filter(Employee.id == target_id).first()
            if not emp or emp.manager_id != user_id:
                return "You can only reject leaves for employees assigned to you."

        leave.status = "rejected"
        leave.rejection_reason = reason

        notif = Notification(
            emp_id=target_id,
            message=f"Your {leave.leave_type} leave ({leave.start_date} to {leave.end_date}) was rejected. Reason: {reason}",
            type="leave_rejected",
        )
        db.add(notif)
        db.commit()

        emp = db.query(Employee).filter(Employee.id == target_id).first()
        emp_name = emp.name if emp else target_id
        return f"❌ Rejected {leave.leave_type} leave for {emp_name}. Reason: {reason}"
    finally:
        db.close()


def get_employee_details(message: str, user_id: str, role: str) -> str:
    """Agent tool: Get employee profile details."""
    lookup_id = user_id
    id_match = re.search(r'(?:details|info|profile)\s+(?:for\s+)?(EMP\d+)', message, re.IGNORECASE)
    if id_match and role in ["manager", "hr"]:
        lookup_id = id_match.group(1)
    elif id_match and role == "employee" and id_match.group(1) != user_id:
        return "I can only show your own details. For other employees, ask HR or your manager."

    emp = get_employee_info(lookup_id)
    if not emp:
        return f"Employee {lookup_id} not found."

    lines = [
        f"📋 Employee Details: {emp.name}",
        f"  • ID: {emp.id}",
        f"  • Email: {emp.email}",
        f"  • Phone: {emp.phone or 'N/A'}",
        f"  • Designation: {emp.designation or 'N/A'}",
        f"  • Role: {emp.role}",
        f"  • Project Tag: {emp.project_tag or 'Not tagged'}",
        f"  • Tagged: {'Yes' if emp.project_tag else 'No'}",
    ]
    if emp.manager_id:
        mgr = get_employee_info(emp.manager_id)
        if mgr:
            lines.append(f"  • Manager: {mgr.name} ({emp.manager_id})")

    return "\n".join(lines)


def general_query(message: str, user_id: str, role: str) -> str:
    """Agent tool: Handle general conversation, greetings, small talk, and general knowledge."""
    response = _get_client().chat.completions.create(
        model=GPT_MODEL,
        messages=[
            {"role": "system", "content": "You are a helpful assistant. Answer any question briefly and directly in 1-3 lines. You can answer general knowledge, coding, and non-work questions too."},
            {"role": "user", "content": message}
        ],
        temperature=0.2,
        max_tokens=150,
    )
    return response.choices[0].message.content or "Hello! How can I help you today?"


def get_cancellation_status(message: str, user_id: str, role: str) -> str:
    """Agent tool: Check status of cancellation requests."""
    db = SessionLocal()
    try:
        records = db.query(LeaveRecord).filter(
            LeaveRecord.employee_id == user_id,
            LeaveRecord.cancellation_requested == True
        ).all()

        if not records:
            return "You have no pending cancellation requests."

        lines = ["📋 Cancellation Requests:"]
        for rec in records:
            lines.append(
                f"• {rec.type.title()} ({rec.start_date} to {rec.end_date}): "
                f"Status: {rec.cancellation_status or 'Pending review'}"
            )
        return "\n".join(lines)
    finally:
        db.close()


def hr_override(message: str, user_id: str, role: str) -> str:
    """Agent tool: HR override for leave records (HR only)."""
    if role != "hr":
        return "Only HR can use override functions."

    id_match = re.search(r'(?:override|override\s+for)\s+(EMP\d+)', message, re.IGNORECASE)
    if not id_match:
        return "Please specify an employee. Example: 'override EMP003'"

    target_id = id_match.group(1)
    action = "approve" if "approv" in message.lower() else "reject"

    db = SessionLocal()
    try:
        leave = db.query(LeaveRecord).filter(
            LeaveRecord.employee_id == target_id,
            LeaveRecord.status == "pending"
        ).order_by(LeaveRecord.applied_on.desc()).first()

        if not leave:
            return f"No pending leave found for {target_id}."

        leave.status = "approved" if action == "approve" else "rejected"
        leave.is_auto_approved = False

        emp = db.query(Employee).filter(Employee.id == target_id).first()
        emp_name = emp.name if emp else target_id

        notif = Notification(
            emp_id=target_id,
            message=f"HR has {action}d your {leave.type} leave ({leave.start_date} to {leave.end_date}).",
            type=f"hr_{action}d",
        )
        db.add(notif)
        db.commit()
        return f"🏢 HR override: {action}d leave for {emp_name}."
    finally:
        db.close()


def get_agent_memory(message: str, user_id: str, role: str) -> str:
    """Agent tool: Retrieve conversation history for context."""
    return conversation_memory.get_formatted(user_id)


# ======================================================================
# LANGCHAIN @tool WRAPPERS (bound to GPT-4o-mini for function calling)
# Note: These are kept but may be deprecated in favor of the supervisor.py flow
# ======================================================================

@tool(description="Get company leave policy with rules for each leave type.")
def get_leave_policy():
    return {
        "casual": "Max 24/year, 2/month credited from DOJ (carried forward). First 2 requests/month → auto-approved (max 2 days at a time). 3rd+ request/month or >2 days at once → manager approval. No negative balance.",
        "sick": "Max 12/year (no carry forward). First 1 request/month → auto-approved (max 1 day at a time). 2nd+ request/month or >1 day at once → manager approval. No negative balance.",
        "business": "Max 20/year (no carry forward). Always manager approval. No auto-approval. No negative balance.",
        "emergency": "Max 10/year (no carry forward). First 1 request/month → auto-approved (max 1 day at a time). 2nd+ request/month or >1 day at once → manager approval. No negative balance.",
        "family": "Max 10/year (no carry forward). Always manager approval. No auto-approval. No negative balance.",
        "unpaid": "No limit. Apply when all other leave types are exhausted. Always manager approval. No balance required.",
        "project_tag": "Tagged employees → ALL leaves require manager approval (no auto-approval).",
        "cancellation": "Pending leaves can be cancelled (removed from history). Approved leaves create cancellation request for manager.",
        "advance_booking": "Up to 2 months in advance.",
    }


@tool("get_leave_balance", description="Get employee leave balance showing remaining and limit for each leave type.")
def get_leave_balance_wrapper(employee_id: str) -> dict:
    db = SessionLocal()
    try:
        return get_leave_balance(db, _resolve_employee_scope(employee_id))
    finally:
        db.close()


@tool("get_leave_history", description="Get last 200 leave records for an employee.")
def get_leave_history_wrapper(employee_id: str, limit: int = 200) -> list:
    db = SessionLocal()
    try:
        return get_leave_history(db, _resolve_employee_scope(employee_id), limit)
    finally:
        db.close()


@tool("get_upcoming_leaves", description="Get upcoming approved/pending leaves for an employee.")
def get_upcoming_leaves_wrapper(employee_id: str) -> list:
    db = SessionLocal()
    try:
        return get_upcoming_leaves(db, _resolve_employee_scope(employee_id))
    finally:
        db.close()


@tool("apply_leave", description="Apply for leave. REQUIRED: leave_type, start_date, end_date. Ask the user for leave_type and reason if not provided. Dates must be YYYY-MM-DD format.")
def apply_leave_wrapper(employee_id: str, leave_type: str, start_date: str, end_date: str, reason: str = "") -> dict:
    db = SessionLocal()
    try:
        return apply_leave(db, _resolve_employee_scope(employee_id), leave_type, start_date, end_date, reason)
    finally:
        db.close()


@tool("get_leave_by_date", description="Get leave records for an employee on a specific date. Accepts YYYY-MM-DD or DD-MM-YYYY. Returns empty list if no leave exists on that exact date.")
def get_leave_by_date_wrapper(employee_id: str, date: str) -> list:
    db = SessionLocal()
    try:
        eid = _resolve_employee_scope(employee_id)
        try:
            lookup = datetime.strptime(date[:10], "%Y-%m-%d").strftime("%Y-%m-%d")
        except ValueError:
            try:
                lookup = datetime.strptime(date[:10], "%d-%m-%Y").strftime("%Y-%m-%d")
            except ValueError:
                return [{"error": f"Invalid date format: {date}"}]
        records = db.query(LeaveRecord).filter(
            LeaveRecord.employee_id == eid,
            LeaveRecord.start_date == lookup
        ).all()
        return [{"id": r.id, "type": r.type, "start_date": r.start_date,
                  "end_date": r.end_date, "status": r.status, "reason": r.reason} for r in records]
    finally:
        db.close()


@tool("cancel_leave", description="Cancel a leave by DATE (YYYY-MM-DD) and optional leave_type to disambiguate. Looks up the employee's leave on that date and cancels it. Automatically handles: pending->deleted, approved->cancellation_requested, cancellation_requested->approved. Reason is optional.")
def cancel_leave_wrapper(date: str, reason: str = "", leave_type: str = "") -> dict:
    db = SessionLocal()
    try:
        emp_id = _resolve_employee_scope(CURRENT_AI_CONTEXT.get("user_id", ""))
        try:
            lookup_date = datetime.strptime(date[:10], "%Y-%m-%d").strftime("%Y-%m-%d")
        except ValueError:
            try:
                lookup_date = datetime.strptime(date[:10], "%d-%m-%Y").strftime("%Y-%m-%d")
            except ValueError:
                return {"success": False, "error": f"Invalid date format: {date}. Use YYYY-MM-DD."}
        q = db.query(LeaveRecord).filter(
            LeaveRecord.employee_id == emp_id,
            LeaveRecord.start_date == lookup_date,
        )
        if leave_type:
            q = q.filter(LeaveRecord.type == leave_type)
        leaves = q.all()
        if not leaves:
            return {"success": False, "error": f"No leave found on {lookup_date} for you."}
        if len(leaves) > 1:
            types = [f"{l.type} ({l.id})" for l in leaves]
            return {"success": False, "error": f"Multiple leaves on {lookup_date}: {', '.join(types)}. Use leave_type to specify."}
        leave = leaves[0]
        if leave.status in ("pending", "rejected"):
            db.delete(leave)
            db.commit()
            return {"success": True, "status": "pending", "action": "deleted"}
        if leave.status == "cancellation_requested":
            leave.status = "approved"
            leave.cancellation_reason = None
            db.commit()
            return {"success": True, "status": "cancellation_requested", "action": "reverted"}
        if not reason:
            return {"success": False, "reason_required": True, "message": f"This {leave.type} leave on {lookup_date} is APPROVED. A cancellation reason is required. Please ask the user for a reason and call cancel_leave again with it."}
        leave.status = "cancellation_requested"
        leave.cancellation_reason = reason
        db.commit()
        return {"success": True, "status": "approved", "action": "cancellation_requested"}
    finally:
        db.close()


@tool("get_pending_requests", description="Get pending leave requests for a manager.")
def get_pending_requests_wrapper(manager_id: str) -> list:
    db = SessionLocal()
    try:
        return get_pending_requests(db, manager_id)
    finally:
        db.close()


@tool("approve_leave", description="Approve a pending leave request.")
def approve_leave_wrapper(leave_id: str) -> dict:
    db = SessionLocal()
    try:
        return approve_leave(db, leave_id)
    finally:
        db.close()


@tool("reject_leave", description="Reject a pending leave request with a reason.")
def reject_leave_wrapper(leave_id: str, reason: str) -> dict:
    db = SessionLocal()
    try:
        return reject_leave(db, leave_id, reason)
    finally:
        db.close()


@tool("get_cancellation_requests", description="Get cancellation requests for a manager.")
def get_cancellation_requests_wrapper(manager_id: str) -> list:
    db = SessionLocal()
    try:
        return get_cancellation_requests(db, manager_id)
    finally:
        db.close()


@tool("approve_cancellation", description="Approve a cancellation request, removing the leave from history.")
def approve_cancellation_wrapper(leave_id: str) -> dict:
    db = SessionLocal()
    try:
        return approve_cancellation(db, leave_id)
    finally:
        db.close()


@tool("reject_cancellation", description="Reject a cancellation request, keeping the leave as approved.")
def reject_cancellation_wrapper(leave_id: str, reason: str = "") -> dict:
    db = SessionLocal()
    try:
        return reject_cancellation(db, leave_id, reason)
    finally:
        db.close()


@tool("check_team_availability", description="Check how many team members are available on a given date.")
def check_team_availability_wrapper(manager_id: str, date: str) -> dict:
    db = SessionLocal()
    try:
        return check_team_availability(db, manager_id, date)
    finally:
        db.close()


@tool("get_team_leave_stats", description="Get team leave statistics for a period.")
def get_team_leave_stats_wrapper(manager_id: str, period: str = "all") -> dict:
    db = SessionLocal()
    try:
        return get_team_leave_stats(db, manager_id, period)
    finally:
        db.close()


@tool("get_employee_leave_detail", description="Get detailed employee info by ID including leave balance.")
def get_employee_leave_detail_wrapper(employee_id: str) -> dict:
    db = SessionLocal()
    try:
        return get_employee_by_id(db, employee_id)
    finally:
        db.close()


@tool("get_all_employees", description="Get list of all employees.")
def get_all_employees_wrapper() -> list:
    db = SessionLocal()
    try:
        return get_all_employees(db)
    finally:
        db.close()


@tool("get_employee_by_id", description="Get detailed employee info by ID.")
def get_employee_by_id_wrapper(employee_id: str) -> dict:
    db = SessionLocal()
    try:
        return get_employee_by_id(db, employee_id)
    finally:
        db.close()


@tool("get_hr_contact", description="Get HR contact information.")
def get_hr_contact_wrapper() -> dict:
    db = SessionLocal()
    try:
        return get_hr_contact(db)
    finally:
        db.close()


@tool("get_manager_info", description="Get manager info for an employee.")
def get_manager_info_wrapper(employee_id: str) -> dict:
    db = SessionLocal()
    try:
        return get_manager_info(db, employee_id)
    finally:
        db.close()


@tool("get_leave_by_id", description="Get full details of a specific leave request by its ID.")
def get_leave_by_id_wrapper(leave_id: str) -> dict:
    db = SessionLocal()
    try:
        return get_leave_by_id(db, leave_id)
    finally:
        db.close()


@tool(description="Semantic search company leave policies using vector embeddings.")
def search_policy(query: str):
    from ai.engine.vector_store import seed_policy_vector_store
    try:
        store = seed_policy_vector_store()
        import chromadb.utils.embedding_functions as ef
        import os
        import chromadb
        ef_instance = ef.OpenAIEmbeddingFunction(
            api_key=os.getenv("OPENAI_API_KEY", ""),
            model_name="text-embedding-ada-002",
        )
        client = chromadb.PersistentClient(path=os.path.join(os.path.dirname(os.path.dirname(__file__)), "chroma_db"))
        collection = client.get_collection("leaveflow_policies", embedding_function=ef_instance)
        results = collection.query(query_texts=[query], n_results=3)
        if results["documents"] and results["documents"][0]:
            docs = results["documents"][0]
            return {"answer": docs[0], "results": [{"policy": d} for d in docs]}
        return {"answer": "No matching policy found.", "results": []}
    except Exception as e:
        return {"answer": f"Search error: {str(e)}", "results": []}


@tool(description="Answer questions using RAG on the policy knowledge base.")
def rag_query(question: str):
    rag = RagPipeline()
    try:
        result = rag.query(question)
        return {"answer": result["answer"], "sources": [d["content"] for d in result["source_documents"]]}
    except Exception as e:
        return {"answer": f"RAG engine error: {str(e)}. Try again later.", "sources": []}


@tool(description="Get recent conversation history for a user.")
def get_conversation_history(user_id: str):
    history = conversation_memory.get(user_id)
    return {"history": [{"role": m["role"], "content": m["content"][:200]} for m in history[-10:]]}


@tool("get_employee_leave_summary", description="Get weekly/monthly leave summary with leave type and status breakdown for the employee.")
def get_employee_leave_summary_wrapper(employee_id: str) -> str:
    return get_employee_leave_summary_details(_resolve_employee_scope(employee_id))


@tool("get_my_profile", description="Get the logged-in employee's full profile (name, ID, email, phone, gender, DOB, DOJ, designation, project tag, manager, nationality, address).")
def get_my_profile_wrapper(employee_id: str) -> str:
    return get_my_employee_profile(_resolve_employee_scope(employee_id))


# ======================================================================
# TOOLS LIST (used by LangGraph agent for function binding)
# ======================================================================

TOOLS = [
    get_leave_balance_wrapper, get_leave_history_wrapper, get_leave_by_date_wrapper, get_upcoming_leaves_wrapper,
    apply_leave_wrapper, cancel_leave_wrapper, get_pending_requests_wrapper,
    approve_leave_wrapper, reject_leave_wrapper, get_cancellation_requests_wrapper,
    approve_cancellation_wrapper, reject_cancellation_wrapper, check_team_availability_wrapper,
    get_leave_policy, get_team_leave_stats_wrapper, get_employee_leave_detail_wrapper,
    get_all_employees_wrapper, get_employee_by_id_wrapper, get_hr_contact_wrapper, get_manager_info_wrapper,
    search_policy, rag_query, get_conversation_history, get_leave_by_id_wrapper,
    get_employee_leave_summary_wrapper, get_my_profile_wrapper,
]
