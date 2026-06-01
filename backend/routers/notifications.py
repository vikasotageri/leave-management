from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db, Notification, generate_id
from datetime import datetime

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class CreateNotificationRequest(BaseModel):
    user_id: str
    title: str
    message: str = ""
    type: str = "in-app"
    to: str | None = None
    email: str | None = None


@router.get("/{user_id}")
def list_notifications(user_id: str, db: Session = Depends(get_db)):
    notifs = db.query(Notification).filter(
        Notification.user_id == user_id
    ).order_by(Notification.created_at.desc()).limit(50).all()
    return [
        {
            "id": n.id, "userId": n.user_id, "title": n.title,
            "message": n.message, "type": n.type, "read": n.read,
            "to": n.to, "email": n.email,
            "createdAt": n.created_at,
        }
        for n in notifs
    ]


@router.post("")
def create_notification(req: CreateNotificationRequest, db: Session = Depends(get_db)):
    notif = Notification(
        id=generate_id("N"),
        user_id=req.user_id,
        title=req.title,
        message=req.message,
        type=req.type,
        to=req.to,
        email=req.email,
        created_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
    )
    db.add(notif)
    db.commit()
    return {"success": True, "id": notif.id}


@router.put("/{notification_id}/read")
def mark_read(notification_id: str, db: Session = Depends(get_db)):
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if notif:
        notif.read = True
        db.commit()
    return {"success": True}


@router.put("/{user_id}/read-all")
def mark_all_read(user_id: str, db: Session = Depends(get_db)):
    db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.read == False
    ).update({"read": True})
    db.commit()
    return {"success": True}


@router.delete("/{user_id}/clear-all")
def clear_all_notifications(user_id: str, db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.user_id == user_id).delete()
    db.commit()
    return {"success": True}
