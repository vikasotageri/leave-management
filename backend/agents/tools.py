from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import Employee, LeaveRecord, Notification
from datetime import datetime
from langchain_core.tools import tool


def months_since(doj_str):
    if not doj_str:
        return 0
    try:
        try:
            doj = datetime.strptime(doj_str, "%d-%m-%Y")
        except ValueError:
            doj = datetime.strptime(doj_str, "%Y-%m-%d")
        now = datetime.now()
        return max(1, (now.year - doj.year) * 12 + (now.month - doj.month) + 1)
    except:
        return 1


def parse_date_flexible(date_str):
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


def get_leave_balance(db: Session, employee_id: str):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        return {"error": "Employee not found"}

    ms = months_since(emp.doj)
    now = datetime.now()

    # Only approved/auto-approved/cancellation_requested count toward balance
    # cancellation_requested keeps balance unchanged until manager decides
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

    year_recs = [r for r in taken_records if r.start_date and (parse_date_flexible(r.start_date) or datetime(1,1,1)).year == now.year]
    month_recs = [r for r in taken_records if r.start_date
                  and (parse_date_flexible(r.start_date) or datetime(1,1,1)).year == now.year
                  and (parse_date_flexible(r.start_date) or datetime(1,1,1)).month == now.month]

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
    auto_cancel_stale_pending(db)
    records = db.query(LeaveRecord).filter(
        LeaveRecord.employee_id == employee_id
    ).order_by(LeaveRecord.applied_on.desc()).limit(limit).all()
    return [{"id": r.id, "employeeId": r.employee_id, "type": r.type, "start_date": r.start_date, "end_date": r.end_date,
             "status": r.status, "applied_on": r.applied_on, "reason": r.reason, "document": r.document,
             "cancellation_reason": r.cancellation_reason, "rejection_reason": r.rejection_reason} for r in records]


def get_upcoming_leaves(db: Session, employee_id: str):
    auto_cancel_stale_pending(db)
    today = datetime.now().strftime("%Y-%m-%d")
    records = db.query(LeaveRecord).filter(
        LeaveRecord.employee_id == employee_id,
        LeaveRecord.start_date >= today,
        LeaveRecord.status.in_(["approved", "auto-approved", "pending", "cancellation_requested"])
    ).order_by(LeaveRecord.start_date).all()
    return [{"id": r.id, "type": r.type, "start_date": r.start_date, "end_date": r.end_date, "status": r.status} for r in records]


def get_employee_by_id(db: Session, employee_id: str):
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
        "password": emp.plain_password or emp.password or "",
        "leave_balance": get_leave_balance(db, employee_id),
        "projectTag": emp.project_tag,
    }


def get_all_employees(db: Session):
    emps = db.query(Employee).filter(Employee.role == "employee").all()
    return [{"id": e.id, "name": e.name, "email": e.email, "role": e.role, "doj": e.doj, "gender": e.gender} for e in emps]


def apply_leave(db: Session, employee_id: str, leave_type: str, start_date: str, end_date: str, reason: str, document: str = None):
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

    # Use leave's year/month for limit checks
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

    year_recs = [r for r in taken_records if r.start_date and (parse_date_flexible(r.start_date) or datetime(1,1,1)).year == leave_year]
    month_recs = [r for r in taken_records if r.start_date
                  and (parse_date_flexible(r.start_date) or datetime(1,1,1)).year == leave_year
                  and (parse_date_flexible(r.start_date) or datetime(1,1,1)).month == leave_month]

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

    # Balance check — reject if insufficient for requested days
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

    # Check for duplicate leave on same date
    existing = db.query(LeaveRecord).filter(
        LeaveRecord.employee_id == employee_id,
        LeaveRecord.start_date <= end_date,
        LeaveRecord.end_date >= start_date,
        LeaveRecord.status.in_(["pending", "approved", "auto-approved", "cancellation_requested"])
    ).first()
    if existing:
        return {"success": False, "error": f"Already applied for {existing.type} leave on this date (Status: {existing.status})"}

    # Auto-approval rules (untagged employees only, per leave's month)
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

    # Tagged employees: always go to pending (no auto-approval)
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

    # Group dates by (year, month) for per-month limit checks
    from collections import defaultdict
    dates_by_month = defaultdict(list)
    all_years = set()
    for d, dt in zip(dates, parsed):
        dates_by_month[(dt.year, dt.month)].append(d)
        all_years.add(dt.year)

    # Year records: include all years the dates span (normally just one)
    year_recs = [r for r in taken_records if r.start_date
                 and (parse_date_flexible(r.start_date) or datetime(1,1,1)).year in all_years]

    new_days = len(dates)

    # Balance check (annual limits) — use the earliest year as reference for casual accrual
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

    # Per-month check: if ANY month exceeds its limit, ALL go to pending
    # Only casual, sick, emergency can auto-approve (within limits)
    # Business, family, unpaid always need manager approval
    if monthly_limit > 0:
        can_auto_approve = True
        for (yr, mo), month_dates in dates_by_month.items():
            existing_in_month = len([r for r in taken_records if r.type == leave_type
                                     and r.start_date
                                     and (parse_date_flexible(r.start_date) or datetime(1,1,1)).year == yr
                                     and (parse_date_flexible(r.start_date) or datetime(1,1,1)).month == mo])
            new_in_month = len(month_dates)
            if existing_in_month + 1 > monthly_limit or new_in_month > at_a_time_limit:
                can_auto_approve = False
                break
        if can_auto_approve:
            status = "auto-approved"
            approved_by = "system"

    # Tagged employees: always go to pending (no auto-approval)
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
    leave = db.query(LeaveRecord).filter(LeaveRecord.id == leave_id).first()
    if not leave:
        return {"success": False, "error": "Leave not found"}

    leave_date = parse_date_flexible(leave.start_date)
    if (datetime.now() - leave_date).days > 70:
        return {"success": False, "error": "Cannot cancel leave older than 70 days"}

    if leave.status in ("pending", "rejected"):
        # Cancel before approval or already rejected → completely remove from history
        db.delete(leave)
        db.commit()
        return {"success": True, "auto_cancelled": True}

    if leave.status == "cancellation_requested":
        # Employee withdrew cancellation request → revert to approved
        leave.status = "approved"
        leave.cancellation_reason = None
        db.commit()
        return {"success": True, "reverted": True}

    # Cancel after approval → send cancellation request to manager
    leave.status = "cancellation_requested"
    leave.cancellation_reason = reason
    db.commit()
    return {"success": True}


def approve_leave(db: Session, leave_id: str, approver_id: str = "MGR001"):
    leave = db.query(LeaveRecord).filter(LeaveRecord.id == leave_id).first()
    if not leave:
        return {"success": False, "error": "Leave not found"}

    leave.status = "approved"
    leave.approved_by = approver_id
    leave.notified_manager = True
    db.commit()
    return {"success": True}


def reject_leave(db: Session, leave_id: str, reason: str):
    leave = db.query(LeaveRecord).filter(LeaveRecord.id == leave_id).first()
    if not leave:
        return {"success": False, "error": "Leave not found"}

    leave.status = "rejected"
    leave.rejection_reason = reason
    leave.notified_manager = True
    db.commit()
    return {"success": True}


def approve_cancellation(db: Session, leave_id: str):
    leave = db.query(LeaveRecord).filter(LeaveRecord.id == leave_id).first()
    if not leave:
        return {"success": False, "error": "Leave not found"}

    # Hard delete — removed from history, balance auto-restored by dynamic computation
    db.delete(leave)
    db.commit()
    return {"success": True}


def reject_cancellation(db: Session, leave_id: str, reason: str = ""):
    leave = db.query(LeaveRecord).filter(LeaveRecord.id == leave_id).first()
    if not leave:
        return {"success": False, "error": "Leave not found"}
    leave.status = "approved"
    leave.rejection_reason = reason
    db.commit()
    return {"success": True}


def get_leave_by_id(db: Session, leave_id: str):
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


def auto_cancel_stale_pending(db: Session):
    cutoff = (datetime.now() - timedelta(days=4)).strftime("%Y-%m-%d %H:%M:%S")
    stale = db.query(LeaveRecord).filter(
        LeaveRecord.status == "pending",
        LeaveRecord.applied_on < cutoff,
    ).all()
    for rec in stale:
        db.delete(rec)
    if stale:
        db.commit()


def get_pending_requests(db: Session, manager_id: str):
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
    hr = db.query(Employee).filter(Employee.role == "hr").first()
    if not hr:
        return {"error": "No HR found"}
    return {"id": hr.id, "name": hr.name, "email": hr.email}


def get_manager_info(db: Session, employee_id: str):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp or not emp.manager_id:
        return {"error": "No manager assigned"}
    mgr = db.query(Employee).filter(Employee.id == emp.manager_id).first()
    if not mgr:
        return {"error": "Manager not found"}
    return {"id": mgr.id, "name": mgr.name, "email": mgr.email}


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
    from database import SessionLocal
    db = SessionLocal()
    try:
        return get_leave_balance(db, employee_id)
    finally:
        db.close()


@tool("get_leave_history", description="Get last 200 leave records for an employee.")
def get_leave_history_wrapper(employee_id: str, limit: int = 200) -> list:
    from database import SessionLocal
    db = SessionLocal()
    try:
        return get_leave_history(db, employee_id, limit)
    finally:
        db.close()


@tool("get_upcoming_leaves", description="Get upcoming approved/pending leaves for an employee.")
def get_upcoming_leaves_wrapper(employee_id: str) -> list:
    from database import SessionLocal
    db = SessionLocal()
    try:
        return get_upcoming_leaves(db, employee_id)
    finally:
        db.close()


@tool("apply_leave", description="Apply for leave. Dates must be in YYYY-MM-DD format.")
def apply_leave_wrapper(employee_id: str, leave_type: str, start_date: str, end_date: str, reason: str = "") -> dict:
    from database import SessionLocal
    db = SessionLocal()
    try:
        return apply_leave(db, employee_id, leave_type, start_date, end_date, reason)
    finally:
        db.close()


@tool("cancel_leave", description="Cancel a leave. Reason is optional for pending leaves.")
def cancel_leave_wrapper(leave_id: str, reason: str = "") -> dict:
    from database import SessionLocal
    db = SessionLocal()
    try:
        return cancel_leave(db, leave_id, reason)
    finally:
        db.close()


@tool("get_pending_requests", description="Get pending leave requests for a manager.")
def get_pending_requests_wrapper(manager_id: str) -> list:
    from database import SessionLocal
    db = SessionLocal()
    try:
        return get_pending_requests(db, manager_id)
    finally:
        db.close()


@tool("approve_leave", description="Approve a pending leave request.")
def approve_leave_wrapper(leave_id: str) -> dict:
    from database import SessionLocal
    db = SessionLocal()
    try:
        return approve_leave(db, leave_id)
    finally:
        db.close()


@tool("reject_leave", description="Reject a pending leave request with a reason.")
def reject_leave_wrapper(leave_id: str, reason: str) -> dict:
    from database import SessionLocal
    db = SessionLocal()
    try:
        return reject_leave(db, leave_id, reason)
    finally:
        db.close()


@tool("get_cancellation_requests", description="Get cancellation requests for a manager.")
def get_cancellation_requests_wrapper(manager_id: str) -> list:
    from database import SessionLocal
    db = SessionLocal()
    try:
        return get_cancellation_requests(db, manager_id)
    finally:
        db.close()


@tool("approve_cancellation", description="Approve a cancellation request, removing the leave from history.")
def approve_cancellation_wrapper(leave_id: str) -> dict:
    from database import SessionLocal
    db = SessionLocal()
    try:
        return approve_cancellation(db, leave_id)
    finally:
        db.close()


@tool("reject_cancellation", description="Reject a cancellation request, keeping the leave as approved.")
def reject_cancellation_wrapper(leave_id: str, reason: str = "") -> dict:
    from database import SessionLocal
    db = SessionLocal()
    try:
        return reject_cancellation(db, leave_id, reason)
    finally:
        db.close()


@tool("check_team_availability", description="Check how many team members are available on a given date.")
def check_team_availability_wrapper(manager_id: str, date: str) -> dict:
    from database import SessionLocal
    db = SessionLocal()
    try:
        return check_team_availability(db, manager_id, date)
    finally:
        db.close()


@tool("get_team_leave_stats", description="Get team leave statistics for a period.")
def get_team_leave_stats_wrapper(manager_id: str, period: str = "all") -> dict:
    from database import SessionLocal
    db = SessionLocal()
    try:
        return get_team_leave_stats(db, manager_id, period)
    finally:
        db.close()


@tool("get_employee_leave_detail", description="Get detailed employee info by ID including leave balance.")
def get_employee_leave_detail_wrapper(employee_id: str) -> dict:
    from database import SessionLocal
    db = SessionLocal()
    try:
        return get_employee_by_id(db, employee_id)
    finally:
        db.close()


@tool("get_all_employees", description="Get list of all employees.")
def get_all_employees_wrapper() -> list:
    from database import SessionLocal
    db = SessionLocal()
    try:
        return get_all_employees(db)
    finally:
        db.close()


@tool("get_employee_by_id", description="Get detailed employee info by ID.")
def get_employee_by_id_wrapper(employee_id: str) -> dict:
    from database import SessionLocal
    db = SessionLocal()
    try:
        return get_employee_by_id(db, employee_id)
    finally:
        db.close()


@tool("get_hr_contact", description="Get HR contact information.")
def get_hr_contact_wrapper() -> dict:
    from database import SessionLocal
    db = SessionLocal()
    try:
        return get_hr_contact(db)
    finally:
        db.close()


@tool("get_manager_info", description="Get manager info for an employee.")
def get_manager_info_wrapper(employee_id: str) -> dict:
    from database import SessionLocal
    db = SessionLocal()
    try:
        return get_manager_info(db, employee_id)
    finally:
        db.close()


@tool("get_leave_by_id", description="Get full details of a specific leave request by its ID.")
def get_leave_by_id_wrapper(leave_id: str) -> dict:
    from database import SessionLocal
    db = SessionLocal()
    try:
        return get_leave_by_id(db, leave_id)
    finally:
        db.close()


@tool(description="Semantic search company leave policies using vector embeddings.")
def search_policy(query: str):
    from ai_engine.vector_store import seed_policy_vector_store
    store = seed_policy_vector_store()
    results = store.search(query, n_results=3)
    if not results:
        return {"answer": "No matching policy found.", "results": []}
    return {
        "answer": results[0]["document"],
        "results": [{"policy": r["document"], "category": r["metadata"].get("category", "")} for r in results],
    }


@tool(description="Answer questions using RAG on the policy knowledge base.")
def rag_query(question: str):
    from ai_engine.rag import RagPipeline
    rag = RagPipeline()
    try:
        result = rag.query(question)
        return {"answer": result["answer"], "sources": [d["content"] for d in result["source_documents"]]}
    except Exception as e:
        return {"answer": f"RAG engine error: {str(e)}. Try again later.", "sources": []}


@tool(description="Get recent conversation history for a user.")
def get_conversation_history(user_id: str):
    from ai_engine.agent_memory import conversation_memory
    history = conversation_memory.get(user_id)
    return {"history": [{"role": m["role"], "content": m["content"][:200]} for m in history[-10:]]}


TOOLS = [
    get_leave_balance_wrapper, get_leave_history_wrapper, get_upcoming_leaves_wrapper,
    apply_leave_wrapper, cancel_leave_wrapper, get_pending_requests_wrapper,
    approve_leave_wrapper, reject_leave_wrapper, get_cancellation_requests_wrapper,
    approve_cancellation_wrapper, reject_cancellation_wrapper, check_team_availability_wrapper,
    get_leave_policy, get_team_leave_stats_wrapper, get_employee_leave_detail_wrapper,
    get_all_employees_wrapper, get_employee_by_id_wrapper, get_hr_contact_wrapper, get_manager_info_wrapper,
    search_policy, rag_query, get_conversation_history, get_leave_by_id_wrapper,
]
