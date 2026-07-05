# AGENTS - Pure Python AI Project

## One command to run
```bash
./start.sh
```
Open http://localhost:8000

## Stack
```
Python FastAPI (port 8000) — serves API + React frontend
├── LangGraph (Python) — multi-agent AI orchestration
├── OpenAI GPT-4o-mini — LLM for all agents
└── SQLite — database
```

No Node.js. No JavaScript AI. **100% Python AI backend.**

## Architecture
```
User → React Frontend (static) → Python FastAPI :8000
  → /api/chat → LangGraph StateGraph
    → Supervisor Agent (classifies intent via LLM)
      → Specialist Agent (Employee, Manager, or HR)
        → Tool calls (SQLAlchemy database functions)
        → Natural language response
```

## Project Structure
```
Agentic-AI-Employee-Leave-Management/
├── backend/            # Python FastAPI backend
│   ├── main.py         # FastAPI app, static file serving, SPA fallback
│   ├── database.py     # SQLAlchemy models (Employee, LeaveRecord, Notification, Holiday)
│   ├── auth.py         # JWT auth (python-jose + bcrypt)
│   ├── seed.py         # Seeds HR001 + MGR001 on first run
│   ├── email_service.py # Gmail SMTP
│   ├── routers/        # API endpoints (auth, employees, leaves, notifications, chat, frontend)
│   └── templates/      # Jinja2 HTML templates
├── ai/                 # AI agent code (separate from backend)
│   ├── agents/         # LangGraph agents (supervisor.py, tools.py, graphs.py)
│   ├── engine/         # AI engine (agent_memory.py, rag.py, vector_store.py)
│   └── chroma_db/      # ChromaDB vector store data
├── frontend/           # Static frontend (Jinja2-based)
│   └── static/js/      # Split JS modules (api, utils, auth, chat, hr, employee, manager, notifications)
├── react/              # React SPA frontend (alternative)
│   └── src/            # React components, pages, services, contexts
└── docs/               # Documentation
```

## Key Files
| File | Purpose |
|---|---|
| `backend/main.py` | FastAPI app entry point |
| `backend/database.py` | SQLAlchemy models |
| `backend/auth.py` | JWT auth (python-jose + bcrypt) |
| `backend/seed.py` | Seeds HR001 + MGR001 on first run |
| `backend/email_service.py` | Gmail SMTP |
| `ai/agents/supervisor.py` | OpenAI intent classifier + tool executor |
| `ai/agents/tools.py` | All database query functions (893 lines) |
| `ai/agents/graphs.py` | LangGraph StateGraph definitions (3 roles) |
| `frontend/static/js/` | 9 separate JS modules instead of monolithic app.js |

## AI framework
- **LangGraph** (Python) — `StateGraph` with supervisor + specialist agent nodes
- **OpenAI** — `gpt-4o-mini` for classification + tool calling
- **`langchain-openai`** — bind_tools for function calling
- **Zero regex** — all routing is LLM-driven via `classify_intent()`

## API key
Set `OPENAI_API_KEY` in `backend/.env`:
```
OPENAI_API_KEY=sk-your-key
```
Restart server after changing.

## Credentials (seed)
- HR: `hr@company.com` / `pass123`
- Manager: `manager@company.com` / `pass123`
- New employees: auto-generated `EMPxxx` / `pass123`

## Leave policy
- 2 days/month, max 24/year
- Auto-approval if within limits, no project tag, no team conflict
- Business & project-tagged → manager approval
- 70-day cancellation window
