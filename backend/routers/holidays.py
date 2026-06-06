"""
================================================================================
 LEAVE FLOW — Holidays Router (CRUD for Company Holidays)
================================================================================

 PURPOSE:
  Manages company holidays (days when leave is not counted against balance).
  Holidays are used by the employee dashboard calendar to mark non-working days
  and by the leave application logic to exclude holidays from leave day counts.

 CALLED BY:
  - frontend/static/js/employee.js: loadHolidays() → GET /api/holidays
      → Calendar displays holidays with special styling
  - frontend/static/js/hr.js: holiday management UI

 ROUTES:
  GET    /api/holidays          — List all holidays (sorted by date)
  POST   /api/holidays          — Create a new holiday
  DELETE /api/holidays/{id}    — Delete a holiday

 DATA MODEL (database.py):
  Holiday(id, date, name)
  - id:   Auto-generated ("H001", "H002", ...)
  - date: Date string (YYYY-MM-DD)
  - name: Holiday name (e.g., "Diwali", "Christmas")
================================================================================
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db, Holiday, generate_id

router = APIRouter(prefix="/api/holidays", tags=["holidays"])


class HolidayCreate(BaseModel):
    date: str
    name: str


@router.get("")
def list_holidays(db: Session = Depends(get_db)):
    """List all holidays sorted by date (ascending)."""
    holidays = db.query(Holiday).order_by(Holiday.date).all()
    return [{"id": h.id, "date": h.date, "name": h.name} for h in holidays]


@router.post("")
def create_holiday(req: HolidayCreate, db: Session = Depends(get_db)):
    """Create a new holiday. Rejects duplicate dates."""
    existing = db.query(Holiday).filter(Holiday.date == req.date).first()
    if existing:
        raise HTTPException(status_code=400, detail="Holiday already exists for this date")
    holiday = Holiday(id=generate_id("H"), date=req.date, name=req.name)
    db.add(holiday)
    db.commit()
    return {"success": True, "id": holiday.id}


@router.delete("/{holiday_id}")
def delete_holiday(holiday_id: str, db: Session = Depends(get_db)):
    """Delete a holiday by ID."""
    holiday = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    db.delete(holiday)
    db.commit()
    return {"success": True}
