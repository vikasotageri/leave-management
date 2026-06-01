from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse, Response
from fastapi.templating import Jinja2Templates

router = APIRouter(tags=["frontend"])
templates = None  # Set by main.py


@router.get("/")
def home(request: Request):
    return templates.TemplateResponse(request, "login.html")


@router.get("/login")
def login_page(request: Request):
    return templates.TemplateResponse(request, "login.html")


@router.get("/hr")
def hr_dashboard(request: Request):
    return templates.TemplateResponse(request, "hr_dashboard.html")


@router.get("/employee")
def employee_dashboard(request: Request):
    return templates.TemplateResponse(request, "employee_dashboard.html")


@router.get("/manager")
def manager_dashboard(request: Request):
    return templates.TemplateResponse(request, "manager_dashboard.html")


@router.get("/chat")
def chat_page(request: Request):
    return templates.TemplateResponse(request, "chat.html")


# Redirect old React routes
@router.get("/dashboard")
def old_employee_dash():
    return RedirectResponse("/employee")


@router.get("/apply")
def old_apply():
    return RedirectResponse("/employee")


@router.get("/manager-dashboard")
def old_manager_dash():
    return RedirectResponse("/manager")


@router.get("/manager/team")
def old_manager_team():
    return RedirectResponse("/manager")


@router.get("/hr/dashboard")
def old_hr_dash():
    return RedirectResponse("/hr")


@router.get("/hr/employees")
def old_hr_emps():
    return RedirectResponse("/hr")


@router.get("/favicon.ico")
def favicon():
    return Response(
        content='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🌿</text></svg>',
        media_type="image/svg+xml",
    )
