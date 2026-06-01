from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db, Holiday, generate_id

router = APIRouter(prefix="/api/holidays", tags=["holidays"])


@router.get("")
def list_holidays(db: Session = Depends(get_db)):
    holidays = db.query(Holiday).order_by(Holiday.date).all()
    return [{"id": h.id, "date": h.date, "name": h.name} for h in holidays]
