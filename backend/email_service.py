"""
================================================================================
 LEAVE FLOW — Email Service (Gmail SMTP)
================================================================================

 PURPOSE:
  Sends email notifications using Gmail's SMTP server.
  Used for leave notifications, password resets, and alerts.

 CALLED BY:
  - backend/routers/employees.py → when creating new employee accounts
  - backend/routers/auth.py → when processing forgot-password requests
  - (Future) Leave approval/rejection notifications

 HOW IT WORKS:
  1. Reads SMTP credentials from environment variables
  2. Connects via SSL to smtp.gmail.com:465
  3. Sends HTML-formatted email using smtplib
  4. Falls back to print() if SMTP is not configured (development mode)

 ENVIRONMENT VARIABLES (from backend/.env):
  SMTP_EMAIL    → Gmail address (e.g., your@gmail.com)
  SMTP_PASSWORD → Gmail App Password (not regular password)

 NOTES:
  - Uses SSL (port 465) not STARTTLS (port 587)
  - For Gmail, you MUST use an App Password (2FA required)
  - If SMTP is not configured, emails are logged to console instead
================================================================================
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

SMTP_EMAIL = os.getenv("SMTP_EMAIL", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")


def send_email(to_email: str, subject: str, body: str):
    """
    Send an HTML email via Gmail SMTP.

    Args:
      to_email: Recipient email address
      subject:  Email subject line
      body:     HTML email body content

    FLOW:
      1. Build MIME message with HTML content
      2. Connect to smtp.gmail.com:465 over SSL
      3. Login with SMTP_EMAIL / SMTP_PASSWORD
      4. Send message
      5. Close connection

    If SMTP_EMAIL is not configured, prints to console instead (dev mode).
    """
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print(f"📧 [DEV] Email to {to_email}: {subject}")
        print(body[:200] + "..." if len(body) > 200 else body)
        return

    msg = MIMEMultipart("alternative")
    msg["From"] = SMTP_EMAIL
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "html"))

    try:
        server = smtplib.SMTP_SSL("smtp.gmail.com", 465)
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        print(f"✅ Email sent to {to_email}")
    except Exception as e:
        print(f"❌ Email send failed: {e}")
