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

## Files
| File | Purpose |
|---|---|
| `backend/main.py` | FastAPI app, static file serving, SPA fallback |
| `backend/database.py` | SQLAlchemy models (Employee, LeaveRecord, Notification, Holiday) |
| `backend/auth.py` | JWT auth (python-jose + bcrypt) |
| `backend/seed.py` | Seeds HR001 + MGR001 on first run |
| `backend/email_service.py` | Gmail SMTP |
| `backend/agents/supervisor.py` | OpenAI intent classifier + tool executor + 19 tool schemas |
| `backend/agents/tools.py` | All database query functions |
| `backend/agents/graphs.py` | LangGraph StateGraph definitions (3 roles) |
| `backend/routers/` | auth.py, employees.py, leaves.py, notifications.py, chat.py |

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

## Auto-refresh behavior (manager portal)
- Auto-refresh runs every **6 seconds** on `/manager` page
- Updates: dashboard stats, team member cards, employee detail view (if open), approvals tab list (if visible)
- **Skipped during AI processing** (`window._aiProcessing === true`) — prevents "Loading..." flicker in team list while AI responds
- After AI chat response, employee detail view is refreshed (if open) but NOT `loadManagerDashboard()` — redundant with auto-refresh

## AI chat processing indicator
- When user sends a message, a visible **"Thinking..."** bubble with yellow pulse dot appears in the chat area
- Send button is disabled during processing
- `window._aiProcessing` flag is set to `true` during AI call, `false` after

## Leave policy
- 2 days/month, max 24/year
- Auto-approval if within limits, no project tag, no team conflict
- Business & project-tagged → manager approval
- 70-day cancellation window
