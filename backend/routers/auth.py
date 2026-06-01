from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db, Employee
from auth import hash_password, verify_password, create_access_token, get_current_user

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
