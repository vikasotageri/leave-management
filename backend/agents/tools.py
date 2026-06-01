from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import Employee, LeaveRecord, Notification
from datetime import datetime


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
    records = db.query(LeaveRecord).filter(
        LeaveRecord.employee_id == employee_id
    ).order_by(LeaveRecord.applied_on.desc()).limit(limit).all()
    return [{"id": r.id, "employeeId": r.employee_id, "type": r.type, "start_date": r.start_date, "end_date": r.end_date,
             "status": r.status, "applied_on": r.applied_on, "reason": r.reason, "document": r.document,
             "cancellation_reason": r.cancellation_reason} for r in records]


def get_upcoming_leaves(db: Session, employee_id: str):
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
        "leave_balance": get_leave_balance(db, employee_id),
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

    if start > datetime.now() + timedelta(days=60):
        return {"success": False, "error": "Cannot apply more than 2 months in advance"}

    # Compute dynamic balance
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

    year_recs = [r for r in taken_records if r.start_date and (parse_date_flexible(r.start_date) or datetime(1,1,1)).year == now.year]
    month_recs = [r for r in taken_records if r.start_date
                  and (parse_date_flexible(r.start_date) or datetime(1,1,1)).year == now.year
                  and (parse_date_flexible(r.start_date) or datetime(1,1,1)).month == now.month]

    def count_recs(recs):
        return len(recs)

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

    # Check balance sufficiency
    if leave_type == "casual" and casual_remaining <= 0:
        return {"success": False, "error": "Insufficient casual leave balance"}
    if leave_type == "sick" and sick_remaining <= 0:
        return {"success": False, "error": "Insufficient sick leave balance"}
    if leave_type == "business" and business_remaining <= 0:
        return {"success": False, "error": "Insufficient business leave balance"}
    if leave_type == "emergency" and emergency_remaining <= 0:
        return {"success": False, "error": "Insufficient emergency leave balance"}
    if leave_type == "family" and family_remaining <= 0:
        return {"success": False, "error": "Insufficient family leave balance"}
    # unpaid has no limit, always goes to manager

    # Check for duplicate leave on same date
    existing = db.query(LeaveRecord).filter(
        LeaveRecord.employee_id == employee_id,
        LeaveRecord.start_date <= end_date,
        LeaveRecord.end_date >= start_date,
        LeaveRecord.status.in_(["pending", "approved", "auto-approved", "cancellation_requested"])
    ).first()
    if existing:
        return {"success": False, "error": f"Already applied for {existing.type} leave on this date (Status: {existing.status})"}

    if leave_type == "casual":
        casual_taken_month = count_recs([r for r in month_recs if r.type == "casual"])
        if casual_taken_month < 2:
            status = "auto-approved"
            approved_by = "system"

    elif leave_type == "sick":
        sick_taken_month = count_recs([r for r in month_recs if r.type == "sick"])
        if sick_taken_month < 1:
            status = "auto-approved"
            approved_by = "system"

    elif leave_type == "emergency":
        emergency_taken_month = count_recs([r for r in month_recs if r.type == "emergency"])
        if emergency_taken_month < 1:
            status = "auto-approved"
            approved_by = "system"

    # business, family, unpaid always go to manager

    # Tagged employees: always go to pending (no auto-approval)
    if emp.project_tag:
        status = "pending"
        approved_by = None

    # Create leave record (no balance deduction — computed dynamically from approved records)
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
    for d in dates:
        dt = parse_date_flexible(d)
        if not dt:
            return {"success": False, "error": f"Invalid date format: {d}"}
        if dt > now + timedelta(days=60):
            return {"success": False, "error": "Cannot apply more than 2 months in advance"}
        if dt < now - timedelta(days=1):
            return {"success": False, "error": "Cannot apply for past dates"}

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
    month_recs = [r for r in taken_records if r.start_date
                  and (parse_date_flexible(r.start_date) or datetime(1,1,1)).year == now.year
                  and (parse_date_flexible(r.start_date) or datetime(1,1,1)).month == now.month]

    monthly_limit = {"casual": 2, "sick": 1, "emergency": 1}.get(leave_type, 0)
    existing = len([r for r in month_recs if r.type == leave_type])
    total = existing + len(dates)

    # Balance check (annual limits)
    ms = months_since(emp.doj)
    def days_used(recs):
        total = 0
        for r in recs:
            end = parse_date_flexible(r.end_date)
            start = parse_date_flexible(r.start_date)
            if start and end:
                total += max(1, (end - start).days + 1)
        return total

    year_recs = [r for r in taken_records if r.start_date and (parse_date_flexible(r.start_date) or datetime(1,1,1)).year == now.year]
    casual_taken_all = days_used([r for r in taken_records if r.type == "casual"])
    sick_taken_this_year = days_used([r for r in year_recs if r.type == "sick"])
    business_taken_year = days_used([r for r in year_recs if r.type == "business"])
    emergency_taken_year = days_used([r for r in year_recs if r.type == "emergency"])
    family_taken_year = days_used([r for r in year_recs if r.type == "family"])

    casual_max = ms * 2
    casual_remaining = max(0, casual_max - casual_taken_all)
    sick_remaining = max(0, 12 - sick_taken_this_year)
    business_remaining = max(0, 20 - business_taken_year)
    emergency_remaining = max(0, 10 - emergency_taken_year)
    family_remaining = max(0, 10 - family_taken_year)

    new_days = len(dates)

    if leave_type == "casual" and casual_remaining < new_days:
        return {"success": False, "error": "Insufficient casual leave balance"}
    if leave_type == "sick" and sick_remaining < new_days:
        return {"success": False, "error": "Insufficient sick leave balance"}
    if leave_type == "business" and business_remaining < new_days:
        return {"success": False, "error": "Insufficient business leave balance"}
    if leave_type == "emergency" and emergency_remaining < new_days:
        return {"success": False, "error": "Insufficient emergency leave balance"}
    if leave_type == "family" and family_remaining < new_days:
        return {"success": False, "error": "Insufficient family leave balance"}
    # unpaid has no limit

    # Determine status: if total exceeds monthly limit, ALL go to pending
    if monthly_limit > 0 and total > monthly_limit:
        status = "pending"
        approved_by = None
    elif monthly_limit > 0:
        status = "auto-approved"
        approved_by = "system"
    else:
        status = "pending"
        approved_by = None

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


def reject_cancellation(db: Session, leave_id: str):
    leave = db.query(LeaveRecord).filter(LeaveRecord.id == leave_id).first()
    if not leave:
        return {"success": False, "error": "Leave not found"}
    leave.status = "approved"
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
            "document": leave.document,
        }
    }


def get_pending_requests(db: Session, manager_id: str):
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


def get_leave_policy():
    return {
        "casual": "2/month auto-approved if within limit. >2/month → manager approval. Insufficient balance → application rejected. Balance deducted only after approval.",
        "sick": "1/month auto-approved. >1/month → manager approval. Insufficient balance → rejected. Balance deducted only after approval.",
        "business": "20/year. Always manager approval. Insufficient balance → rejected.",
        "emergency": "10/year. 1/month auto-approved. >1/month → manager. Insufficient balance → rejected.",
        "family": "10/year. Always manager approval. Insufficient balance → rejected.",
        "unpaid": "No limit. Always manager approval. No balance required.",
        "project_tag": "Project tag → ALL leaves require manager approval (no auto-approval).",
        "cancellation": "Pending leaves can be cancelled (removed from history). Approved leaves create cancellation request for manager.",
        "advance_booking": "Up to 2 months in advance.",
    }


TOOL_MAP = {
    "get_leave_balance": lambda db, args: get_leave_balance(db, args["employee_id"]),
    "get_leave_history": lambda db, args: get_leave_history(db, args["employee_id"], args.get("limit", 200)),
    "get_upcoming_leaves": lambda db, args: get_upcoming_leaves(db, args["employee_id"]),
    "apply_leave": lambda db, args: apply_leave(db, args["employee_id"], args["type"], args["start_date"], args["end_date"], args.get("reason", "")),
    "cancel_leave": lambda db, args: cancel_leave(db, args["leave_id"], args.get("reason", "")),
    "get_pending_requests": lambda db, args: get_pending_requests(db, args["manager_id"]),
    "approve_leave": lambda db, args: approve_leave(db, args["leave_id"]),
    "reject_leave": lambda db, args: reject_leave(db, args["leave_id"], args.get("reason", "No reason provided")),
    "get_cancellation_requests": lambda db, args: get_cancellation_requests(db, args["manager_id"]),
    "approve_cancellation": lambda db, args: approve_cancellation(db, args["leave_id"]),
    "reject_cancellation": lambda db, args: reject_cancellation(db, args["leave_id"]),
    "check_team_availability": lambda db, args: check_team_availability(db, args["manager_id"], args["date"]),
    "get_leave_policy": lambda db, args: get_leave_policy(),
    "get_team_leave_stats": lambda db, args: get_team_leave_stats(db, args["manager_id"], args.get("period", "all")),
    "get_employee_leave_detail": lambda db, args: get_employee_by_id(db, args["employee_id"]),
    "get_all_employees": lambda db, args: get_all_employees(db),
    "get_employee_by_id": lambda db, args: get_employee_by_id(db, args["employee_id"]),
    "get_hr_contact": lambda db, args: get_hr_contact(db),
    "get_manager_info": lambda db, args: get_manager_info(db, args["employee_id"]),
    "search_policy": lambda db, args: search_policy(args["query"]),
    "rag_query": lambda db, args: rag_query(args["question"]),
    "get_conversation_history": lambda db, args: get_conversation_history(args["user_id"]),
    "get_leave_by_id": lambda db, args: get_leave_by_id(db, args["leave_id"]),
}


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


def rag_query(question: str):
    from ai_engine.rag import RagPipeline
    rag = RagPipeline()
    try:
        result = rag.query(question)
        return {"answer": result["answer"], "sources": [d["content"] for d in result["source_documents"]]}
    except Exception as e:
        return {"answer": f"RAG engine error: {str(e)}. Try again later.", "sources": []}


def get_conversation_history(user_id: str):
    from ai_engine.agent_memory import conversation_memory
    history = conversation_memory.get(user_id)
    return {"history": [{"role": m["role"], "content": m["content"][:200]} for m in history[-10:]]}
