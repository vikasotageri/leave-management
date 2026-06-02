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
    holidays = db.query(Holiday).order_by(Holiday.date).all()
    return [{"id": h.id, "date": h.date, "name": h.name} for h in holidays]


@router.post("")
def create_holiday(req: HolidayCreate, db: Session = Depends(get_db)):
    existing = db.query(Holiday).filter(Holiday.date == req.date).first()
    if existing:
        raise HTTPException(status_code=400, detail="Holiday already exists for this date")
    holiday = Holiday(id=generate_id("H"), date=req.date, name=req.name)
    db.add(holiday)
    db.commit()
    return {"success": True, "id": holiday.id}


@router.delete("/{holiday_id}")
def delete_holiday(holiday_id: str, db: Session = Depends(get_db)):
    holiday = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    db.delete(holiday)
    db.commit()
    return {"success": True}
