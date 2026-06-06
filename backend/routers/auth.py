"""
================================================================================
 LEAVE FLOW — Authentication Router (Login, Register, Forgot Password)
================================================================================

 PURPOSE:
  Handles all authentication-related HTTP endpoints.
  Provides JWT-based login, self-registration, password reset,
  and current user info retrieval.

 CALLED BY:
  - frontend/static/js/auth.js: login() → POST /api/auth/login
  - frontend/static/js/notifications.js: loadNotifications() → GET /api/auth/me
  - frontend HTML login pages: <form> submits to /api/auth/login

 ROUTES:
  POST /api/auth/login          — Authenticate with email/password, return JWT token
  POST /api/auth/register       — Create a new employee account (public)
  POST /api/auth/forgot-password — Reset password via email
  GET  /api/auth/me             — Get current authenticated user info

 AUTH FLOW:
  1. User submits email + password to POST /login
  2. Server verifies bcrypt hash → creates JWT token (8h expiry)
  3. Client stores token in localStorage
  4. Subsequent requests include Authorization: Bearer <token>
  5. GET /api/auth/me returns user profile decoded from JWT

 DESIGN:
  - Passwords hashed with bcrypt (hash_password from auth.py)
  - JWT tokens use HS256 with configurable secret and expiry
  - Forgot password generates random 10-char alphanumeric password
================================================================================
"""

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
    """
    Reset employee password and email the new password.

    FLOW:
      1. Verify employee ID + email match a valid employee record
      2. Generate random 10-character password
      3. Hash the new password and update the record
      4. Send email with new password via background_tasks
      5. Return success message

    SECURITY:
      - Requires BOTH employee_id AND email to match (prevents brute-force)
      - Only works for employees (not HR/manager accounts)
      - Password is sent in plaintext via email (acceptable for internal tool)
    """
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
    """
    Authenticate user and return JWT token.

    FLOW:
      1. Look up employee by email
      2. Verify password against bcrypt hash
      3. Create JWT token with sub (employee ID) and role claims
      4. Return token + user details

    TOKEN PAYLOAD:
      {"sub": "EMP001", "role": "employee", "exp": <timestamp>}

    ERROR HANDLING:
      - 401: Invalid email or password (generic, no user enumeration)
    """
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
    """
    Get current authenticated user's profile.

    The get_current_user dependency decodes the JWT from the
    Authorization header and returns the Employee object.

    Used by:
      - Notifications polling (to verify user is logged in)
      - Employee/Manager/HR dashboard init
    """
    return {
        "id": user.id, "name": user.name, "email": user.email,
        "role": user.role, "doj": user.doj, "phone": user.phone,
        "managerId": user.manager_id, "projectTag": user.project_tag,
        "leaveBalance": user.leave_balance,
    }


@router.post("/register")
def register(req: CreateEmployeeRequest, db: Session = Depends(get_db)):
    """
    Self-registration endpoint (public).

    FLOW:
      1. Check if email already exists
      2. Generate next EMP ID (EMP001, EMP002, ...)
      3. Create Employee record with hashed password
      4. Return new employee details

    NOTE: This is a simple registration. For production, consider
    admin approval flow or email verification.
    """
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
