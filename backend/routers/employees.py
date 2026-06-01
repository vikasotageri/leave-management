import os
import json
import secrets
import string
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from database import get_db, Employee, LeaveRecord, Notification, generate_id
from auth import hash_password, get_current_user
from agents.tools import get_leave_balance, get_leave_history
from email_service import send_email

router = APIRouter(prefix="/api/employees", tags=["employees"])


def generate_random_password(length=8):
    chars = string.ascii_letters + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


class CreateEmployeeRequest(BaseModel):
    first_name: str = Field(alias="firstName")
    middle_name: str = Field(default="", alias="middleName")
    last_name: str = Field(alias="lastName")
    email: str
    phone: str = ""
    country_code: str = Field(default="+1", alias="countryCode")
    dob: str = ""
    doj: str = ""
    address: str = ""
    nationality: str = ""
    designation: str = ""
    gender: str = ""
    project_tag: str | None = Field(default=None, alias="projectTag")
    manager_id: str = Field(default="MGR001", alias="managerId")
    document: str | None = None

    model_config = {"populate_by_name": True}

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v):
        return v.strip().lower()

    @field_validator("phone")
    @classmethod
    def trim_phone(cls, v):
        return v.strip() if v else v

    @field_validator("country_code")
    @classmethod
    def trim_cc(cls, v):
        return v.strip() if v else v


@router.get("")
def list_employees(db: Session = Depends(get_db), user: Employee = Depends(get_current_user)):
    if user.role not in ("hr", "manager"):
        raise HTTPException(status_code=403, detail="Not authorized")
    from agents.tools import get_leave_balance
    emps = db.query(Employee).filter(Employee.role == "employee").all()
    return [
        {
            "id": e.id, "name": e.name, "email": e.email, "role": e.role,
            "doj": e.doj, "phone": e.phone, "nationality": e.nationality,
            "designation": e.designation, "projectTag": e.project_tag,
            "gender": e.gender,
            "leaveBalance": get_leave_balance(db, e.id), "hasDocument": bool(e.document),
        }
        for e in emps
    ]


@router.get("/all")
def all_employees(db: Session = Depends(get_db)):
    emps = db.query(Employee).all()
    return [
        {
            "id": e.id, "name": e.name, "email": e.email, "role": e.role,
            "doj": e.doj, "phone": e.phone, "nationality": e.nationality,
            "designation": e.designation, "projectTag": e.project_tag,
            "gender": e.gender,
            "leaveBalance": e.leave_balance,
        }
        for e in emps
    ]


@router.get("/{employee_id}")
def get_employee(employee_id: str, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    from agents.tools import get_leave_balance
    computed_balance = get_leave_balance(db, employee_id)
    return {
        "id": emp.id, "name": emp.name, "email": emp.email, "role": emp.role,
        "phone": emp.phone, "dob": emp.dob, "doj": emp.doj, "address": emp.address,
        "nationality": emp.nationality, "designation": emp.designation,
        "gender": emp.gender,
        "projectTag": emp.project_tag, "managerId": emp.manager_id,
        "leaveBalance": computed_balance, "password": emp.plain_password or emp.password,
        "document": emp.document,
    }


@router.post("")
def create_employee(req: CreateEmployeeRequest, db: Session = Depends(get_db), user: Employee = Depends(get_current_user)):
    if user.role != "hr":
        raise HTTPException(status_code=403, detail="Only HR can create employees")

    existing = db.query(Employee).filter(func.lower(Employee.email) == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists with other employee. Please give another.")

    full_phone = f"{req.country_code}{req.phone}"
    existing_phone = db.query(Employee).filter(
        (Employee.phone == full_phone) | (Employee.phone == req.phone)
    ).first()
    if existing_phone:
        raise HTTPException(status_code=400, detail="Phone number already exists with other employee. Please give another.")

    count = db.query(Employee).filter(Employee.role == "employee").count()
    new_id = f"EMP{count + 1:03d}"
    password = generate_random_password()
    name_parts = [req.first_name]
    if req.middle_name:
        name_parts.append(req.middle_name)
    name_parts.append(req.last_name)
    full_name = " ".join(name_parts)

    total_accrued = 0
    if req.doj:
        from datetime import datetime
        try:
            doj = datetime.strptime(req.doj, "%d-%m-%Y")
        except ValueError:
            doj = datetime.strptime(req.doj, "%Y-%m-%d")
        now = datetime.now()
        months = max(0, (now.year - doj.year) * 12 + (now.month - doj.month))
        total_accrued = months * 2  # casual accrual

    emp = Employee(
        id=new_id,
        name=full_name,
        email=req.email,
        password=hash_password(password),
        plain_password=password,
        role="employee",
        phone=full_phone,
        dob=req.dob,
        doj=req.doj,
        address=req.address,
        nationality=req.nationality,
        designation=req.designation,
        gender=req.gender,
        project_tag=req.project_tag,
        manager_id=req.manager_id,
        document=req.document,
        leave_balance={
            "sick": {"taken": 0, "limit": 12},
            "casual": {"taken": 0, "limit": 24},
            "business": {"taken": 0, "limit": 20},
            "emergency": {"taken": 0, "limit": 10},
            "family": {"taken": 0, "limit": 10},
            "paid": {"taken": 0, "limit": 100},
            "unpaid": {"taken": 0, "limit": 999},
            "totalAccrued": total_accrued,
            "totalTaken": 0,
        },
    )
    db.add(emp)
    db.add(Notification(
        user_id=new_id,
        title="Welcome to LeaveFlow!",
        message=f"Account created. ID: {new_id}, Email: {req.email}, Password: {password}, DOJ: {req.doj}",
        type="account_created",
    ))
    db.add(Notification(
        user_id=user.id,
        title="New Employee Onboarded 🎉",
        message=f"{full_name} ({new_id}) has been onboarded. Credentials sent to {req.email}.",
        type="employee_created",
    ))
    db.commit()

    import threading
    threading.Thread(target=send_email, args=(
        req.email,
        "Welcome to LeaveFlow - Your Account Credentials",
        f"""<div style='font-family:sans-serif;padding:24px;max-width:500px'>
<h2 style='color:#2563eb'>Welcome to LeaveFlow! 🎉</h2>
<p>Hi {full_name},</p>
<p>Your employee account has been created. Here are your login credentials:</p>
<table style='width:100%;border-collapse:collapse;margin:16px 0'>
<tr><td style='padding:8px;border:1px solid #e5e7eb;font-weight:600;color:#374151'>Employee ID</td><td style='padding:8px;border:1px solid #e5e7eb;color:#2563eb;font-family:monospace'>{new_id}</td></tr>
<tr><td style='padding:8px;border:1px solid #e5e7eb;font-weight:600;color:#374151'>Email</td><td style='padding:8px;border:1px solid #e5e7eb'>{req.email}</td></tr>
<tr><td style='padding:8px;border:1px solid #e5e7eb;font-weight:600;color:#374151'>Password</td><td style='padding:8px;border:1px solid #e5e7eb;font-family:monospace;font-weight:bold;color:#d97706'>{password}</td></tr>
<tr><td style='padding:8px;border:1px solid #e5e7eb;font-weight:600;color:#374151'>Date of Joining</td><td style='padding:8px;border:1px solid #e5e7eb'>{req.doj}</td></tr>
<tr><td style='padding:8px;border:1px solid #e5e7eb;font-weight:600;color:#374151'>Gender</td><td style='padding:8px;border:1px solid #e5e7eb'>{req.gender or "—"}</td></tr>
<tr><td style='padding:8px;border:1px solid #e5e7eb;font-weight:600;color:#374151'>Project Tag</td><td style='padding:8px;border:1px solid #e5e7eb'>{req.project_tag or "—"}</td></tr>
</table>
<p>Login at <a href='http://localhost:8000/login' style='color:#2563eb'>http://localhost:8000/login</a> and start managing your leaves.</p>
<p style='color:#6b7280;font-size:12px;margin-top:20px'>This is an automated message from LeaveFlow.</p>
</div>""",
    ), daemon=True).start()

    total_accrued = max(0, total_accrued)
    return {
        "success": True,
        "employee": {
            "id": new_id, "name": full_name, "email": req.email,
            "phone": full_phone, "nationality": req.nationality,
            "designation": req.designation, "doj": req.doj,
            "gender": req.gender,
            "projectTag": req.project_tag,
            "document": req.document,
            "password": password,
            "leaveBalance": {
                "sick": {"taken": 0, "limit": 12},
                "casual": {"taken": 0, "limit": 24},
                "business": {"taken": 0, "limit": 20},
                "emergency": {"taken": 0, "limit": 10},
                "family": {"taken": 0, "limit": 10},
                "paid": {"taken": 0, "limit": 100},
                "unpaid": {"taken": 0, "limit": 999},
                "totalAccrued": total_accrued,
                "totalTaken": 0,
            },
        },
    }


@router.delete("/{employee_id}")
def delete_employee(employee_id: str, db: Session = Depends(get_db), user: Employee = Depends(get_current_user)):
    if user.role != "hr":
        raise HTTPException(status_code=403, detail="Only HR can delete employees")

    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    if emp.role != "employee":
        raise HTTPException(status_code=400, detail="Can only delete employees")

    db.query(LeaveRecord).filter(LeaveRecord.employee_id == employee_id).delete()
    db.query(Notification).filter(Notification.user_id == employee_id).delete()
    db.delete(emp)
    db.commit()

    return {"success": True}


@router.get("/{employee_id}/balance")
def employee_balance(employee_id: str, db: Session = Depends(get_db)):
    return get_leave_balance(db, employee_id)


@router.get("/{employee_id}/leaves")
def employee_leaves(employee_id: str, limit: int = 10, db: Session = Depends(get_db)):
    return get_leave_history(db, employee_id, limit)


@router.get("/{employee_id}/upcoming")
def employee_upcoming(employee_id: str, db: Session = Depends(get_db)):
    from agents.tools import get_upcoming_leaves as gul
    return gul(db, employee_id)


class UpdateDocumentRequest(BaseModel):
    document: Optional[str] = None

    model_config = {"populate_by_name": True}


@router.get("/{employee_id}/document")
def get_document(employee_id: str, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp or not emp.document:
        raise HTTPException(status_code=404, detail="No document found")
    import base64
    try:
        header, b64data = emp.document.split(",", 1)
        content_type = header.replace("data:", "").replace(";base64", "")
        return Response(content=base64.b64decode(b64data), media_type=content_type)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid document data")


@router.put("/{employee_id}/document")
def update_document(employee_id: str, req: UpdateDocumentRequest, db: Session = Depends(get_db), user: Employee = Depends(get_current_user)):
    if user.role not in ("hr",):
        raise HTTPException(status_code=403, detail="Only HR can update documents")
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    emp.document = req.document
    db.commit()
    return {"success": True, "hasDocument": bool(req.document)}


class ProjectTagRequest(BaseModel):
    project_tag: str | None = Field(default=None, alias="projectTag")
    model_config = {"populate_by_name": True}


@router.put("/{employee_id}/project-tag")
def update_project_tag(employee_id: str, req: ProjectTagRequest, db: Session = Depends(get_db), user: Employee = Depends(get_current_user)):
    if user.role not in ("hr", "manager"):
        raise HTTPException(status_code=403, detail="Only HR or Manager can update project tag")
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    emp.project_tag = req.project_tag or None
    db.commit()
    return {"success": True, "projectTag": emp.project_tag}
