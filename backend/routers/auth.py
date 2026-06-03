from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db, Employee
from auth import hash_password, verify_password, create_access_token, get_current_user
from email_service import send_email
import secrets
import string

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class CreateEmployeeRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "employee"
    phone: str = ""
    dob: str = ""
    doj: str = ""
    address: str = ""
    project_tag: str | None = None
    manager_id: str | None = "MGR001"


class ForgotPasswordRequest(BaseModel):
    employee_id: str
    email: str


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(
        Employee.id == req.employee_id,
        Employee.email == req.email,
        Employee.role == "employee",
    ).first()
    if not emp:
        raise HTTPException(status_code=404, detail="No employee found with that ID and email. Please enter correct Employee ID and Email.")

    new_pass = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(10))
    emp.password = hash_password(new_pass)
    emp.plain_password = new_pass
    db.commit()

    html = f"""
    <h2>Password Reset - LeaveFlow</h2>
    <p>Dear {emp.name},</p>
    <p>Your password has been reset as requested.</p>
    <p><b>New Password:</b> {new_pass}</p>
    <hr>
    <p><b>Your Account Details:</b></p>
    <p>Employee ID: <b>{emp.id}</b></p>
    <p>Email: <b>{emp.email}</b></p>
    <p>Date of Joining: <b>{emp.doj}</b></p>
    <hr>
    <p>Please log in and change your password.</p>
    <p>Regards,<br>LeaveFlow Team</p>
    """
    background_tasks.add_task(send_email, emp.email, "LeaveFlow - Password Reset", html)

    return {"success": True, "message": "New password sent to your email"}


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.email == req.email).first()
    if not emp or not verify_password(req.password, emp.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": emp.id, "role": emp.role})
    return {
        "success": True,
        "token": token,
        "user": {
            "id": emp.id, "name": emp.name, "email": emp.email,
            "role": emp.role, "doj": emp.doj, "phone": emp.phone,
            "managerId": emp.manager_id, "projectTag": emp.project_tag,
        },
    }


@router.get("/me")
def get_me(user: Employee = Depends(get_current_user)):
    return {
        "id": user.id, "name": user.name, "email": user.email,
        "role": user.role, "doj": user.doj, "phone": user.phone,
        "managerId": user.manager_id, "projectTag": user.project_tag,
        "leaveBalance": user.leave_balance,
    }


@router.post("/register")
def register(req: CreateEmployeeRequest, db: Session = Depends(get_db)):
    existing = db.query(Employee).filter(Employee.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    count = db.query(Employee).filter(Employee.role == "employee").count()
    new_id = f"EMP{count + 1:03d}"

    emp = Employee(
        id=new_id,
        name=req.name,
        email=req.email,
        password=hash_password(req.password),
        role=req.role,
        phone=req.phone,
        dob=req.dob,
        doj=req.doj,
        address=req.address,
        project_tag=req.project_tag,
        manager_id=req.manager_id,
    )
    db.add(emp)
    db.commit()

    return {"success": True, "employee": {"id": emp.id, "name": emp.name, "email": emp.email, "role": emp.role}}
