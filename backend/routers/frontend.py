"""
================================================================================
 LEAVE FLOW — Frontend Router (HTML Page Routes + Redirects)
================================================================================

 PURPOSE:
  Defines all HTML page routes for the Jinja2-rendered frontend.
  Maps URL paths to HTML templates and handles legacy redirects from
  the previous React SPA frontend.

 CALLED BY:
  - Browser navigation / page loads
  - main.py includes this router via app.include_router(frontend_router)

 ROUTES:

  Main Pages:
    GET  /                → Redirect → /employee/login
    GET  /login           → Redirect → /employee/login
    GET  /employee/login  → employee_login.html
    GET  /manager/login   → manager_login.html
    GET  /hr/login        → hr_login.html
    GET  /employee        → employee_dashboard.html
    GET  /manager         → manager_dashboard.html
    GET  /hr              → hr_dashboard.html
    GET  /chat            → chat.html

  Legacy React SPA Redirects:
    /dashboard         → /employee
    /apply             → /employee
    /manager-dashboard → /manager
    /manager/team      → /manager
    /hr/dashboard      → /hr
    /hr/employees      → /hr

  Other:
    GET /favicon.ico   → Inline SVG icon

 SETUP:
  The `templates` variable is set by main.py after creating the
  Jinja2Templates instance, since the templates directory path
  is configured in the main application file.
================================================================================
"""

from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse, Response
from fastapi.templating import Jinja2Templates

router = APIRouter(tags=["frontend"])
templates = None  # Set by main.py after Jinja2Templates instantiation


@router.get("/")
def home():
    """Root URL → employee login page."""
    return RedirectResponse("/employee/login")


@router.get("/login")
def login_page():
    """Generic /login → employee login page."""
    return RedirectResponse("/employee/login")


@router.get("/employee/login")
def employee_login(request: Request):
    """Employee login page (email/password form)."""
    return templates.TemplateResponse(request, "employee_login.html")


@router.get("/manager/login")
def manager_login(request: Request):
    """Manager login page."""
    return templates.TemplateResponse(request, "manager_login.html")


@router.get("/hr/login")
def hr_login(request: Request):
    """HR login page."""
    return templates.TemplateResponse(request, "hr_login.html")


@router.get("/hr")
def hr_dashboard(request: Request):
    """HR dashboard — employee management, leave overview, analytics."""
    return templates.TemplateResponse(request, "hr_dashboard.html")


@router.get("/employee")
def employee_dashboard(request: Request):
    """Employee dashboard — apply leave, view calendar, check balance."""
    return templates.TemplateResponse(request, "employee_dashboard.html")


@router.get("/manager")
def manager_dashboard(request: Request):
    """Manager dashboard — approve/reject leaves, view team."""
    return templates.TemplateResponse(request, "manager_dashboard.html")


@router.get("/chat")
def chat_page(request: Request):
    """Standalone AI chat assistant page."""
    return templates.TemplateResponse(request, "chat.html")


# -------------------------------------------------------------------
# Legacy React SPA redirects (preserved for backward compatibility)
# -------------------------------------------------------------------
@router.get("/dashboard")
def old_employee_dash():
    """Old React SPA /dashboard route."""
    return RedirectResponse("/employee")

@router.get("/apply")
def old_apply():
    """Old React SPA /apply route."""
    return RedirectResponse("/employee")

@router.get("/manager-dashboard")
def old_manager_dash():
    """Old React SPA /manager-dashboard route."""
    return RedirectResponse("/manager")

@router.get("/manager/team")
def old_manager_team():
    """Old React SPA /manager/team route."""
    return RedirectResponse("/manager")

@router.get("/hr/dashboard")
def old_hr_dash():
    """Old React SPA /hr/dashboard route."""
    return RedirectResponse("/hr")

@router.get("/hr/employees")
def old_hr_emps():
    """Old React SPA /hr/employees route."""
    return RedirectResponse("/hr")


@router.get("/favicon.ico")
def favicon():
    """Inline SVG favicon (no external file needed)."""
    return Response(
        content='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🌿</text></svg>',
        media_type="image/svg+xml",
    )
