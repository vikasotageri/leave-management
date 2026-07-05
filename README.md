---
title: MSIS Leave Management System
emoji: 📋
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
---

# 🤖 MSIS AI Leave Management System

<div align="center">

**Manipal School of Information Science, Manipal**

[![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-teal?logo=fastapi)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.3-orange?logo=langchain)](https://langchain-ai.github.io/langgraph/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-green?logo=openai)](https://openai.com)
[![SQLite](https://img.shields.io/badge/SQLite-3-blue?logo=sqlite)](https://sqlite.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://docker.com)
[![HuggingFace](https://img.shields.io/badge/HuggingFace-Spaces-yellow?logo=huggingface)](https://huggingface.co/spaces)

**Live Demo → [VikasOtageri-leaveflow.hf.space](https://VikasOtageri-leaveflow.hf.space)**

</div>

---

## 📋 Quick Links

- [🌐 Visit Live Demo (no install needed)](#-option-1-visit-the-live-demo-no-installation)
- [💻 Run Locally on Your Computer](#-option-2-run-locally-on-your-computer)
- [🔧 Integrate Into Your Own Project](#-option-3-integrate-into-your-own-project)
- [🧠 Architecture Explained (simple)](#-architecture-overview--explained-simply)
- [📁 Project Structure](#-project-structure)

---

## 👋 For Visitors — How to Use This Project

### 🌐 Option 1: Visit the Live Demo (No Installation)

Open any portal below in your browser. No setup required.

---

#### 🧑‍💼 HR Portal

**URL:** https://VikasOtageri-leaveflow.hf.space/hr

**Demo login:** `hr@company.com` / `pass123`

**What you can do here:**
- View all employees in the system
- Create new employees (ID & password generated automatically)
- Delete employees
- Upload employee documents
- Assign/remove project tags (tagged employees require manager approval for ALL leaves)
- Resend credentials to employees
- View leave history of any employee

**Step-by-step — Creating your first employee:**

| Step | Action |
|------|--------|
| 1 | Login with `hr@company.com` / `pass123` |
| 2 | Click the **"➕ Add"** button |
| 3 | Fill in the form (name, email, phone, DOJ, etc.) |
| 4 | Click **Submit** |
| 5 | A popup shows **Employee ID** (e.g. `EMP001`) and **Password** — **COPY THESE IMMEDIATELY** |

> ⚠️ **Important:** The live demo on Hugging Face Spaces **cannot send emails** (free tier blocks SMTP ports). The welcome email will NOT arrive. You **must** copy the Employee ID and password from the popup. If you close it accidentally, click **"Resend Credentials"** on the employee's card — the password appears in the notification bell 🔔.
>
> ✅ When you run the system **locally** on your computer with Gmail credentials set up, emails will work.

---

#### 👔 Manager Portal

**URL:** https://VikasOtageri-leaveflow.hf.space/manager

**Demo login:** `manager@company.com` / `pass123`

**What you can do here:**
- See dashboard stats: pending leaves, approved today, total team members
- Approve or reject employee leave requests
- Manage cancellation requests
- View team members with their leave balances
- Click any employee to see their leave history
- **AI Chat** — ask questions like *"How many leaves did I approve today?"* or *"Show team summary"*

**Step-by-step:**

| Step | Action |
|------|--------|
| 1 | Login with `manager@company.com` / `pass123` |
| 2 | See dashboard stats at the top |
| 3 | Go to **"Approvals"** tab → See pending requests |
| 4 | Click ✅ **Approve** or ❌ **Reject** |
| 5 | Scroll down to see team members with their leave balances |
| 6 | Click any employee card for detailed history |
| 7 | Use **AI Chat** (bottom-right) to ask questions |

> Dashboard auto-refreshes every 12 seconds.

---

#### 👨‍💼 Employee Portal

**URL:** https://VikasOtageri-leaveflow.hf.space/employee

**Login:** Use the credentials from HR (e.g. `EMP001` + password)

**What you can do here:**
- View your leave balance (Casual, Sick, Emergency, Business, Family, Unpaid)
- Apply for leave (select type, dates, reason)
- Cancel leaves (within 70-day window)
- View your leave history with status
- **AI Chat** — ask *"What is my balance?"* or *"Apply for casual leave tomorrow"*

**Step-by-step — Applying for leave:**

| Step | Action |
|------|--------|
| 1 | Login with your Employee ID and password (from HR) |
| 2 | See your leave balances on the dashboard |
| 3 | Click **"Apply Leave"** |
| 4 | Select leave type, start date, end date, reason |
| 5 | Click **Submit** |
| 6 | If auto-approved → you'll see "Approved" immediately |
| 7 | If pending → Manager will review it |

> **To cancel:** Find the leave in your history → If within 70 days, click **"Cancel"**.

---

### 💻 Option 2: Run Locally on Your Computer

Follow these steps to run the project on your own machine.

#### Step 1: Install Python

| If you have | Check by running | Download if missing |
|------------|-----------------|-------------------|
| **Python 3.12+** | `python --version` | [python.org/downloads](https://www.python.org/downloads/) |
| **Git** | `git --version` | [git-scm.com/downloads](https://git-scm.com/downloads) |

> **Windows users:** During Python install, **check** the box "Add Python to PATH".

#### Step 2: Download the Project

```bash
git clone https://github.com/vikasotageri/leave-management.git
cd leave-management
```

#### Step 3: Set Up Environment Variables

```bash
# Create .env file from the template
cp backend/.env.example backend/.env
```

Now open `backend/.env` in a text editor (Notepad, VS Code, etc.) and fill in:

```
OPENAI_API_KEY=sk-your-openai-api-key-here
SECRET_KEY=any-random-string
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
```

| Field | Required? | What to put |
|-------|-----------|-------------|
| `OPENAI_API_KEY` | ✅ Yes (for AI chat) | Your key from [platform.openai.com](https://platform.openai.com/api-keys) |
| `SECRET_KEY` | ✅ Yes | Any random text, e.g. `mysecret123` |
| `SMTP_USER` | ❌ No | Your Gmail address (if you want email features) |
| `SMTP_PASS` | ❌ No | Your Gmail app password (if you want email features) |

> **No OpenAI key?** That's fine. The system works for all leave operations. Only the AI Chat feature won't work.

#### Step 4: Start the Servers

```bash
bash start.sh
```

Wait 1-2 minutes. You'll see:

```
✅ All servers started!

  Role       | Dashboard                           | Port
  -----------|-------------------------------------|------
  Employee   | http://localhost:8001/employee      | 8001
  Manager    | http://localhost:8002/manager        | 8002
  HR         | http://localhost:8003/hr             | 8003
```

#### Step 5: Open in Browser

| Portal | URL | Login |
|--------|-----|-------|
| 🧑‍💼 HR | http://localhost:8003/hr | `hr@company.com` / `pass123` |
| 👔 Manager | http://localhost:8002/manager | `manager@company.com` / `pass123` |
| 👨‍💼 Employee | http://localhost:8001/employee | Created by HR |

#### Troubleshooting

| Problem | Solution |
|---------|----------|
| `python: command not found` | Install Python, check "Add to PATH" during install |
| `pip: command not found` | Reinstall Python with "Add to PATH" |
| `Port 8001 already in use` | `kill $(lsof -ti:8001)` (Mac/Linux) or restart PC (Windows) |
| AI Chat not working | Check `OPENAI_API_KEY` in `backend/.env` is correct |
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` manually |
| Database error | Delete `backend/leave_management.db` and restart |

---

### 🔧 Option 3: Integrate Into Your Own Project

This project is modular. Take only what you need:

| What you want | What to copy |
|---------------|-------------|
| **AI Agents only** | `ai/` folder — standalone LangGraph multi-agent system |
| **Leave Management API only** | `backend/routers/` + `backend/database.py` |
| **Full system** | Fork the repo, change branding in `backend/templates/base.html`, deploy anywhere |
| **Frontend only** | `frontend/static/js/` — pure vanilla JS, no build step |

---

## 🧠 Architecture Overview — Explained Simply

Think of this system like a **restaurant**:

| In a restaurant | In this system |
|----------------|---------------|
| 🍽️ Customer | **Employee** (wants leave) |
| 📋 Waiter | **Manager** (approves/rejects) |
| 🏪 Manager/Owner | **HR** (manages everything) |
| 🤖 Smart kiosk | **AI Chat** (answers questions) |
| 📁 Order book | **Database** (stores all data) |

### 📐 System Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     YOUR WEB BROWSER                         │
│                                                              │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│   │  👨‍💼 Employee  │  │  👔 Manager   │  │  🧑‍💼 HR      │     │
│   │   Dashboard   │  │   Dashboard   │  │   Dashboard  │     │
│   │  (has AI 🤖)  │  │  (has AI 🤖)  │  │ (no AI chat) │     │
│   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│          └─────────────────┴─────────────────┘              │
└──────────────────────────────┼──────────────────────────────┘
                               │ (Internet)
┌──────────────────────────────┼──────────────────────────────┐
│                       FASTAPI SERVER                        │
│                                                              │
│   ┌──────────────┐    ┌──────────────────┐                  │
│   │  REST APIs   │    │  AI AGENT SYSTEM │                  │
│   │  (Endpoints) │    │  (LangGraph)     │                  │
│   │              │    │                  │                  │
│   │  • Apply     │    │  ┌────────────┐  │                  │
│   │    leave     │    │  │ SUPERVISOR │  │                  │
│   │  • Approve   │    │  │   AGENT    │  │                  │
│   │  • Cancel    │    │  └─────┬──────┘  │                  │
│   │  • View bal. │    │        │         │                  │
│   │  • Create    │    │        ▼         │                  │
│   │    employee  │    │  ┌────────────┐  │                  │
│   │  • Notify    │    │  │ SPECIALIST │  │                  │
│   │              │    │  │  AGENTS    │  │                  │
│   │              │    │  │ • Leave 📝 │  │                  │
│   │              │    │  │ • Approve ✅│  │                  │
│   │              │    │  │ • Policy 📋 │  │                  │
│   │              │    │  │ • Analytics│  │                  │
│   │              │    │  │ • General 💬│  │                  │
│   │              │    │  └────────────┘  │                  │
│   └──────┬───────┘    └──────────────────┘                  │
│          ▼                                                    │
│   ┌────────────────────────────────────────────────────┐    │
│   │              DATABASE (SQLite)                     │    │
│   │  employees │ leaves │ notifications │ holidays    │    │
│   └────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 🔄 How a Leave Request Flows

```
1. Employee logs in → clicks "Apply Leave" → fills form → Submit
2. FastAPI checks: Is user logged in? Is date valid? Within limits?
3. If auto-approvable → saved as "Approved" ✅
4. If needs manager → saved as "Pending" → Manager notified 🔔
5. Manager approves/rejects → Employee notified 🔔
```

### 🔄 How AI Chat Works

```
1. Employee types "What is my leave balance?"
2. SUPERVISOR AGENT reads it → decides: "This is a Leave question"
3. Routes to LEAVE AGENT → calls database → gets balance
4. Returns: "You have 12 casual leaves remaining"
```

### 🤖 AI Agents Explained

**Supervisor Agent** — Like a receptionist. Reads your question and sends it to the right department.

**Specialist Agents** — Like department heads:

| Agent | Handles | Example |
|-------|---------|---------|
| 📝 Leave Agent | Apply/cancel leaves | "Apply casual leave tomorrow" |
| ✅ Approval Agent | Approve/reject requests | "Approve John's leave" |
| 📋 Policy Agent | Policy questions | "What is the leave policy?" |
| 📊 Analytics Agent | Stats & reports | "How many approved today?" |
| 💬 General Agent | Other chat | "Hello" |

**LangGraph** — Framework that connects agents like pipes.

**GPT-4o-mini** — OpenAI's AI model that reads text and decides actions. Your data is NOT stored or used for training.

---

## 📁 Project Structure

```
leave-management/
│
├── ai/                              # AI Agents (LangGraph)
│   ├── agents/
│   │   ├── supervisor.py            # Routes questions to right agent
│   │   ├── tools.py                 # Database query functions
│   │   └── graphs.py                # Agent workflow definitions
│   ├── chroma_db/                   # Vector database for policies
│   └── engine/                      # AI engine utilities
│
├── backend/                         # Python FastAPI server
│   ├── main.py                      # App entry point
│   ├── database.py                  # Database models & connection
│   ├── auth.py                      # JWT login tokens & passwords
│   ├── seed.py                      # Creates demo accounts on first run
│   ├── email_service.py             # Gmail SMTP integration
│   ├── .env.example                 # Environment variable template
│   ├── requirements.txt             # Python dependencies
│   │
│   ├── routers/                     # API endpoints
│   │   ├── auth.py                  # Login / register / forgot password
│   │   ├── employees.py             # CRUD employees, documents, tags
│   │   ├── leaves.py                # Apply / approve / reject / cancel
│   │   ├── notifications.py         # Bell notifications
│   │   ├── chat.py                  # AI chat API
│   │   ├── frontend.py              # Serves HTML pages
│   │   └── holidays.py              # Holiday management
│   │
│   └── templates/                   # HTML pages (Jinja2)
│       ├── base.html                # Shared layout (navbar, bell)
│       ├── chat.html                # AI chat component
│       ├── employee_dashboard.html  # Employee portal
│       ├── employee_login.html      # Employee login page
│       ├── manager_dashboard.html   # Manager portal
│       ├── manager_login.html       # Manager login page
│       ├── manager_calendar.html    # Calendar view
│       ├── hr_dashboard.html        # HR portal
│       ├── hr_login.html            # HR login page
│       └── login.html               # Shared login fallback
│
├── frontend/
│   └── static/js/                   # Vanilla JavaScript
│       ├── api.js                   # HTTP requests & auth
│       ├── app.js                   # Global app state
│       ├── auth.js                  # Login/logout
│       ├── chat.js                  # AI chat UI
│       ├── employee.js              # Employee dashboard logic
│       ├── hr.js                    # HR dashboard logic
│       ├── manager.js               # Manager dashboard logic
│       ├── notifications.js         # Bell notification system
│       └── utils.js                 # Date & helper functions
│
├── react/                           # React frontend (optional)
│   └── src/
│       ├── components/
│       ├── contexts/
│       ├── pages/
│       └── services/
│
├── docs/                            # Documentation
│   ├── AGENTS.md
│   └── README.md
│
├── screenshots/                     # UI images (add your own)
│   ├── employee/
│   ├── hr/
│   └── manager/
│
├── Dockerfile                       # For Hugging Face Spaces
├── start.sh                         # One-command launcher
├── AGENTS.md                        # AI agent instructions
├── package.json                     # Node dependencies (React)
├── .gitignore
└── .dockerignore
```

---

## ✨ Features by Portal

### 👨‍💼 Employee Portal
- Apply leaves (Casual, Sick, Emergency, Business, Family, Unpaid)
- Cancel leaves within 70-day window
- View leave balance & history
- AI Chat assistant 🤖

### 👔 Manager Portal
- Dashboard with team stats (pending, approved today, team size)
- Approve / reject leave requests
- Manage cancellation requests
- View team members & their leave history
- AI Chat assistant 🤖
- Auto-refresh dashboard every 12 seconds

### 🧑‍💼 HR Portal
- View all employees
- Create / delete employees (auto-generates ID & password)
- Upload employee documents
- Assign / remove project tags
- Resend credentials
- View any employee's leave history
- 🔔 Notifications

> 📌 **Note:** HR portal does NOT have AI Chat — only Employee and Manager portals do.

### 🤖 AI Features (Employee & Manager only)
- Supervisor Agent routes questions to the right specialist
- Leave Agent handles applications & cancellations
- Approval Agent handles approve/reject
- Policy Agent explains leave rules
- Analytics Agent provides reports
- All powered by OpenAI GPT-4o-mini + LangGraph

---

## 🏷️ Leave Policy

| Leave Type | Max/Year | Carry Forward | Auto-Approval |
|------------|----------|---------------|---------------|
| 🏖️ Casual | 24 | ✅ Yes | First 2/month (≤2 days) |
| 🤒 Sick | 12 | ❌ No | First 1/month (≤1 day) |
| 🚨 Emergency | 10 | ❌ No | First 1/month (≤1 day) |
| 💼 Business | 20 | ❌ No | Always manager |
| 👨‍👩‍👧‍👦 Family | 10 | ❌ No | Always manager |
| 🕊️ Unpaid | Unlimited | ❌ No | Always manager |

> 📌 **Project Tag Rule:** Tagged employees require manager approval for ALL leaves.
> 📅 **70-Day Window:** Cannot book >70 days ahead or past. Only leaves within 70 days can be cancelled.

---

## 💻 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | ✅ | OpenAI API key (for AI chat) |
| `SECRET_KEY` | ✅ | JWT secret — any random string |
| `SMTP_USER` | ❌ | Gmail address (for email) |
| `SMTP_PASS` | ❌ | Gmail app password (for email) |

### Seeded Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| HR | hr@company.com | pass123 |
| Manager | manager@company.com | pass123 |

---

## 🔐 Authentication Flow

1. User enters email + password → POST `/api/auth/login`
2. Server verifies password → returns JWT token (valid 8 hours)
3. Browser stores token in `localStorage`
4. All future requests include `Authorization: Bearer <token>`
5. `GET /api/auth/me` returns current user info

---

## 👨‍💻 Author

**Vikas Otageri** — AI & Full Stack Developer  
🎓 Currently Student at **Manipal School of Information Science, Manipal**

[![GitHub](https://img.shields.io/badge/GitHub-vikasotageri-181717?logo=github)](https://github.com/vikasotageri)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-vikasotageri-0A66C2?logo=linkedin)](https://www.linkedin.com/in/vikasotageri/)

---

<div align="center">
  <strong>⭐ Star this repo if you found it useful!</strong>
</div>
