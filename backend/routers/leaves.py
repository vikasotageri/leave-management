from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from database import get_db, Employee, LeaveRecord
from auth import get_current_user
from agents.tools import (
    apply_leave, bulk_apply_leave, cancel_leave, approve_leave, reject_leave,
    approve_cancellation, reject_cancellation,
    get_pending_requests, get_cancellation_requests,
    get_team_leaves, get_team_leave_stats, check_team_availability,
)

router = APIRouter(prefix="/api/leaves", tags=["leaves"])


class ApplyLeaveRequest(BaseModel):
    employee_id: str = Field(alias="employeeId")
    type: str = Field(alias="leaveType")
    start_date: str = Field(alias="startDate")
    end_date: str = Field(alias="endDate")
    reason: str = ""
    document: str | None = None

    model_config = {"populate_by_name": True}


class CancelLeaveRequest(BaseModel):
    leave_id: str = Field(alias="leaveId")
    reason: str = ""

    model_config = {"populate_by_name": True}


class ApproveRejectRequest(BaseModel):
    leave_id: str = Field(alias="leaveId")
    reason: str = ""

    model_config = {"populate_by_name": True}


class TeamStatsRequest(BaseModel):
    manager_id: str
    period: str = "all"


class AvailabilityRequest(BaseModel):
    manager_id: str
    date: str


class BulkApplyLeaveRequest(BaseModel):
    employee_id: str = Field(alias="employeeId")
    leave_type: str = Field(alias="leaveType")
    dates: list[str]
    reason: str = ""
    document: str | None = None

    model_config = {"populate_by_name": True}


@router.post("")
def create_leave(req: ApplyLeaveRequest, db: Session = Depends(get_db)):
    result = apply_leave(db, req.employee_id, req.type, req.start_date, req.end_date, req.reason, req.document)
    return result


@router.post("/bulk")
def bulk_create(req: BulkApplyLeaveRequest, db: Session = Depends(get_db)):
    return bulk_apply_leave(db, req.employee_id, req.leave_type, req.dates, req.reason, req.document)


@router.post("/cancel")
def cancel(req: CancelLeaveRequest, db: Session = Depends(get_db)):
    return cancel_leave(db, req.leave_id, req.reason)


@router.post("/approve")
def approve(req: ApproveRejectRequest, db: Session = Depends(get_db), user: Employee = Depends(get_current_user)):
    return approve_leave(db, req.leave_id, user.id)


@router.post("/reject")
def reject(req: ApproveRejectRequest, db: Session = Depends(get_db)):
    return reject_leave(db, req.leave_id, req.reason)


@router.post("/approve-cancellation")
def approve_canc(req: ApproveRejectRequest, db: Session = Depends(get_db)):
    return approve_cancellation(db, req.leave_id)


@router.post("/reject-cancellation")
def reject_canc(req: ApproveRejectRequest, db: Session = Depends(get_db)):
    return reject_cancellation(db, req.leave_id)


@router.get("/pending/{manager_id}")
def pending(manager_id: str, db: Session = Depends(get_db)):
    return get_pending_requests(db, manager_id)


@router.get("/cancellations/{manager_id}")
def cancellations(manager_id: str, db: Session = Depends(get_db)):
    return get_cancellation_requests(db, manager_id)


@router.get("/team/{manager_id}")
def team_leaves(manager_id: str, db: Session = Depends(get_db)):
    return get_team_leaves(db, manager_id)


@router.post("/stats")
def team_stats(req: TeamStatsRequest, db: Session = Depends(get_db)):
    return get_team_leave_stats(db, req.manager_id, req.period)


@router.post("/availability")
def availability(req: AvailabilityRequest, db: Session = Depends(get_db)):
    return check_team_availability(db, req.manager_id, req.date)


@router.get("/employee/{employee_id}")
def employee_leave_records(employee_id: str, db: Session = Depends(get_db)):
    from agents.tools import get_leave_history as glh
    return glh(db, employee_id, 200)
