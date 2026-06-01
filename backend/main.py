import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.templating import Jinja2Templates
from dotenv import load_dotenv
from database import Base, engine
from seed import seed_database
from ai_engine.vector_store import seed_policy_vector_store
from routers import auth, employees, leaves, notifications, chat, frontend, holidays

load_dotenv()

BASE_DIR = os.path.dirname(__file__)

Base.metadata.create_all(bind=engine)
seed_database()
seed_policy_vector_store()

app = FastAPI(title="LeaveFlow API", version="1.0.0")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(leaves.router)
app.include_router(notifications.router)
app.include_router(chat.router)
app.include_router(holidays.router)
app.include_router(frontend.router, prefix="")

app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

# Make templates accessible to other modules
import routers.frontend as _fe
_fe.templates = templates

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
