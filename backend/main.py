"""
================================================================================
 LEAVE FLOW — FastAPI Application Entry Point
================================================================================

 PURPOSE:
  This is the main server entry point. It configures and starts the FastAPI
  application, registers all route handlers (REST + frontend), mounts static
  files, seeds initial data, and initialises the AI vector store.

 SYSTEM DESIGN:
  The app follows a modular architecture:
    backend/main.py          ← ENTRY POINT (this file)
    backend/database.py      ← SQLAlchemy models & DB engine
    backend/auth.py          ← JWT + bcrypt authentication
    backend/seed.py          ← Seeds HR/Manager accounts on first run
    backend/routers/         ← REST API endpoint handlers
    backend/templates/       ← Jinja2 HTML templates (legacy frontend)
    ai/agents/               ← LangGraph agent definitions
    ai/engine/               ← AI engine (RAG, vector store, memory)
    frontend/static/js/      ← Split JavaScript modules

 CALLED BY:
  - start.sh (production): runs `python3 backend/main.py` on ports 8001-8003
  - Direct: `python3 backend/main.py` (single instance on port 8000)

 FLOW:
  1. sys.path is set up so ai/ and backend/ packages are importable
  2. Database tables are created via SQLAlchemy metadata.create_all
  3. Seed data (HR001, MGR001 accounts) is inserted if not present
  4. Policy vector store is seeded for RAG-based Q&A
  5. FastAPI starts with all routers + static file mount + CORS + no-cache
  6. Static JS files served from frontend/static/js/ at /static/js/*
  7. HTML templates served from backend/templates/ via Jinja2

 ROUTE PREFIXES:
  /api/auth/*       → auth.router (login, forgot-password)
  /api/employees/*  → employees.router (CRUD, document mgmt)
  /api/leaves/*     → leaves.router (apply, approve, cancel)
  /api/notifications/* → notifications.router
  /api/chat/*       → chat.router (LangGraph-powered AI)
  /api/holidays/*   → holidays.router
  /employee/*       → frontend.router (Jinja2 templates)
  /manager/*        → frontend.router
  /hr/*             → frontend.router
  /static/*         → StaticFiles mount

 ENVIRONMENT VARIABLES (from backend/.env):
  PORT          → Server port (default: 8000)
  DATABASE_URL  → SQLite or PostgreSQL connection string

 AUTHORIZATION:
  - All /api/* routes are protected via JWT Bearer tokens (HTTPBearer)
  - The frontend.router serves public HTML templates
  - No-cache middleware prevents back-button auto-login after logout
================================================================================
"""
import os
import sys
import time

BASE_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.dirname(BASE_DIR)
sys.path.insert(0, PROJECT_ROOT)
sys.path.insert(0, BASE_DIR)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.base import BaseHTTPMiddleware
from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(BASE_DIR, ".env"))
from database import Base, engine
from seed import seed_database
from ai.engine.vector_store import seed_policy_vector_store
from routers import auth, employees, leaves, notifications, chat, frontend, holidays

Base.metadata.create_all(bind=engine)
seed_database()
seed_policy_vector_store()

app = FastAPI(title="LeaveFlow API", version="1.0.0")

# ---- Middleware: prevent browser caching of HTML pages ----
# This ensures that after logging out, the user cannot press "Back"
# to see cached authenticated pages (bfcache bypass).
class NoCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        ct = response.headers.get("content-type", "")
        if ct.startswith("text/html") or ct.startswith("application/javascript") or ct.startswith("text/javascript"):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response

app.add_middleware(NoCacheMiddleware)

templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))
templates.env.globals["cache_buster"] = str(int(time.time()))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Register all REST API routers ----
app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(leaves.router)
app.include_router(notifications.router)
app.include_router(chat.router)
app.include_router(holidays.router)
app.include_router(frontend.router, prefix="")

# Mount static files (JS, CSS, images) from frontend/static/ → /static/*
app.mount("/static", StaticFiles(directory=os.path.join(PROJECT_ROOT, "frontend", "static")), name="static")

# Make the Jinja2 templates object accessible to frontend.py router
import routers.frontend as _fe
_fe.templates = templates


@app.get("/api/health")
def health():
    """
    Health check endpoint.
    Called by monitoring tools and load balancers.
    Also serves as a quick test that the server is running.
    """
    return {"status": "ok", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
