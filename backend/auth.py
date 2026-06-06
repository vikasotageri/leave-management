"""
================================================================================
 LEAVE FLOW — JWT Authentication & Password Hashing
================================================================================

 PURPOSE:
  Provides authentication primitives for the entire application:
    - bcrypt password hashing & verification
    - JWT token creation & verification
    - FastAPI dependency for extracting the current authenticated user

 SYSTEM DESIGN:
  All API routes (except login) require a valid JWT Bearer token in the
  Authorization header. The token contains the user ID (sub) and expiry.
  Token expiry is configurable via ACCESS_TOKEN_EXPIRE_MINUTES env var.

 CALLED BY:
  - backend/routers/auth.py      → login endpoint uses verify_password + create_access_token
  - backend/routers/*.py          → route handlers use get_current_user dependency
  - backend/main.py               → imported for router registration

 FLOW:
  1. User logs in with email + password
  2. Server verifies password against bcrypt hash in DB
  3. Server creates JWT with {sub: user_id, role: user.role, exp: ...}
  4. Client stores token in sessionStorage
  5. Client sends token in Authorization: Bearer <token> header
  6. get_current_user dependency decodes & validates token on every request
  7. Expired/invalid tokens return 401 Unauthorized

 JWT PAYLOAD STRUCTURE:
  {
    "sub": "EMP001",          ← user ID
    "role": "employee",       ← user role
    "exp": 1700000000         ← expiration timestamp
  }

 ENVIRONMENT VARIABLES (from backend/.env):
  SECRET_KEY                 ← JWT signing secret (default: leaveflow-secret-key)
  ALGORITHM                  ← JWT algorithm (default: HS256)
  ACCESS_TOKEN_EXPIRE_MINUTES ← Token lifetime (default: 480 = 8 hours)
================================================================================
"""

import os
import bcrypt
from datetime import datetime, timedelta
from dotenv import load_dotenv
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db, Employee

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "leaveflow-secret-key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

security = HTTPBearer()


def hash_password(password: str) -> str:
    """
    Hash a plain-text password using bcrypt with auto-generated salt.
    Called when creating/updating employee accounts.
    Returns: bcrypt hash string (stored in employee.password column)
    """
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain-text password against a bcrypt hash.
    Called during login authentication.
    Returns: True if password matches, False otherwise
    """
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())


def create_access_token(data: dict) -> str:
    """
    Create a JWT access token containing user data.
    Called after successful login.
    Args:
      data: dict with at least {"sub": user_id, "role": user_role}
    Returns: JWT string (signed with SECRET_KEY)
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> dict:
    """
    Decode and verify a JWT token.
    Called by get_current_user on every authenticated request.
    Raises 401 if token is expired, malformed, or signed with wrong key.
    Returns: decoded JWT payload dict
    """
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> Employee:
    """
    FastAPI dependency that extracts and validates the current user.
    Usage in routes:
        async def my_endpoint(current_user: Employee = Depends(get_current_user)):

    FLOW:
      1. Extracts Bearer token from Authorization header
      2. Decodes & verifies JWT
      3. Looks up user in database by ID from token
      4. Returns Employee ORM object (or raises 401)

    Called on EVERY protected API request via:
      - backend/routers/employees.py
      - backend/routers/leaves.py
      - backend/routers/notifications.py
      - backend/routers/chat.py
    """
    payload = verify_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(Employee).filter(Employee.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
