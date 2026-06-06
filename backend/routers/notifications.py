"""
================================================================================
 LEAVE FLOW — Notifications Router (In-App Notifications)
================================================================================

 PURPOSE:
  Manages in-app notifications for the Leave Flow application.
  Notifications are created when leaves are applied, approved, rejected,
  cancelled, or when employees are onboarded.

 CALLED BY:
  - frontend/static/js/notifications.js: pollNotifications() → GET /api/notifications/{user_id}
      → Polled every 10 seconds for real-time updates
  - backend/routers/employees.py: creates notifications on employee creation
  - backend/routers/leaves.py: creates notifications on leave events
  - ai/agents/tools.py: supervisor creates notifications on approve/reject

 ROUTES:
  GET    /api/notifications/{user_id}              — List notifications (latest 50)
  POST   /api/notifications                        — Create a notification
  PUT    /api/notifications/{id}/read              — Mark single notification as read
  PUT    /api/notifications/{user_id}/read-all     — Mark all as read for user
  DELETE /api/notifications/{user_id}/clear-all    — Delete all notifications for user

 DATA MODEL (database.py):
  Notification(id, user_id, title, message, type, to, email, read, created_at)
  - id:   Auto-generated ("N001", "N002", ...)
  - type: "leave_request", "leave_approved", "leave_rejected", "account_created", "in-app"
================================================================================
"""

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
    """
    Get the latest 50 notifications for a user, ordered by creation time (newest first).
    Used by the notification polling system in the frontend.
    """
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
    """Create a new notification for a user."""
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
    """Mark a single notification as read by ID."""
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if notif:
        notif.read = True
        db.commit()
    return {"success": True}


@router.put("/{user_id}/read-all")
def mark_all_read(user_id: str, db: Session = Depends(get_db)):
    """Mark ALL unread notifications as read for a user."""
    db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.read == False
    ).update({"read": True})
    db.commit()
    return {"success": True}


@router.delete("/{user_id}/clear-all")
def clear_all_notifications(user_id: str, db: Session = Depends(get_db)):
    """Delete ALL notifications for a user."""
    db.query(Notification).filter(Notification.user_id == user_id).delete()
    db.commit()
    return {"success": True}
