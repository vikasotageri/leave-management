---
title: Agentic AI Employee Leave Management System
emoji: 📋
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
---

# 🤖 Agentic AI Employee Leave Management System

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

## 📸 Screenshots

| Portal | Preview |
|--------|---------|
| 👨‍💼 **Employee Dashboard** | ![Employee Portal](https://raw.githubusercontent.com/vikasotageri/Agentic-AI-Employee-Leave-Management/master/screenshots/employee.png) |
| 👔 **Manager Dashboard** | ![Manager Portal](https://raw.githubusercontent.com/vikasotageri/Agentic-AI-Employee-Leave-Management/master/screenshots/manager.png) |
| 🧑‍💼 **HR Dashboard** | ![HR Portal](https://raw.githubusercontent.com/vikasotageri/Agentic-AI-Employee-Leave-Management/master/screenshots/hr.png) |

---

## 🤖 AI Chat — How It Works & What to Try

The **AI Chat** (available in Employee & Manager portals) is the heart of this Agentic AI project. It uses **OpenAI GPT-4o-mini** routed through **LangGraph agents** — no hardcoded if-else, no button clicks needed.

### How It Works (Behind the Scenes)

```
You type: "Apply for casual leave tomorrow"
    ↓
Supervisor Agent (LLM) reads your intent
    ↓  "This is about applying leave → route to Leave Agent"
Leave Agent receives your request
    ↓  Calls tool: apply_leave(employee_id, type, date, reason)
Database is updated + policy checked
    ↓
Agent replies: "✅ Casual leave for tomorrow has been approved!"
```

### 🧪 Try These Prompts — Observe the AI in Action

Copy-paste these into the AI Chat and watch what happens:

#### Employee Portal — Try These

| Prompt | What the AI Does | Why It's Cool |
|--------|-----------------|---------------|
| `"What is my leave balance?"` | Calls `get_leave_balance()` tool → reads DB → replies | No menu navigation needed |
| `"Apply for casual leave tomorrow"` | Calls `apply_leave()` → checks policy → auto-approves or routes to manager | One sentence = full transaction |
| `"Cancel my leave on 2026-07-10"` | Calls `cancel_leave()` → checks 70-day window → cancels if eligible | Understands date format |
| `"What is the leave policy?"` | Calls `POLICY_PROMPT` → explains rules in plain English | No need to read docs |
| `"How many casual leaves have I taken this month?"` | Calls `get_leave_history()` → counts by type/month → summarizes | Multi-step reasoning |
| `"Show me my upcoming leaves"` | Calls `get_upcoming_leaves()` → queries approved future leaves | Cross-table query |

#### Manager Portal — Try These

| Prompt | What the AI Does |
|--------|-----------------|
| `"Show me all pending leaves"` | Calls `get_pending_leaves()` → lists team members with pending requests |
| `"How many leaves did I approve today?"` | Calls `get_approved_leaves()` → counts approvals for today's date |
| `"Show team leave summary"` | Calls `get_team_leave_summary()` → aggregates all team members' balances |
| `"Approve John's sick leave"` | Calls `approve_leave()` → finds John's pending sick leave → approves |
| `"Who has the most remaining casual leave?"` | Calls balances for all team → sorts → returns top member |
| `"What leaves are pending from last week?"` | Filters by date range → returns pending leaves from that period |

### 🔍 What to Observe

When you send a prompt, pay attention to:

| What to notice | What it proves |
|----------------|----------------|
| **No buttons clicked** | AI understands natural language — no rigid forms needed |
| **Date understanding** ("tomorrow", "next Monday", "July 10th") | LLM converts fuzzy dates to exact dates |
| **Multi-step responses** ("I checked your balance and you have...") | Agent called a tool, got data, formatted the reply |
| **Policy-aware answers** ("This needs manager approval because...") | Agent checked rules before acting |
| **Error handling** ("I can't find that leave record") | Agent knows its limits and tells you |
| **Context memory** (follow-up questions) | Chat history is maintained within the session |

### 🆚 AI vs Manual (Traditional) Way

| Task | Manual Way | AI Way |
|------|-----------|--------|
| Check balance | Navigate to dashboard → find balance card | Type *"What is my balance?"* → instant reply |
| Apply leave | Click "Apply Leave" → fill form → select dates → submit | Type *"Apply casual leave from Monday to Wednesday"* |
| Cancel leave | Find leave in history → click cancel → confirm | Type *"Cancel my leave on July 10"* |
| Check policy | Open policy document → search for rule | Type *"What's the sick leave policy?"* |
| Manager: Approve | Go to approvals → find employee → click approve | Type *"Approve John's sick leave"* |
| Manager: Report | Manually count leaves across team | Type *"Show team leave summary"* |

---

## 📧 Email Feature — How It Works

This system can send **automatic emails** using Gmail SMTP. Here's what it sends and when:

| Email Trigger | Sent To | Content |
|---------------|---------|---------|
| 🆕 **New employee created** | The new employee's email | Welcome message with Employee ID, password, DOJ, and login link |
| 🔄 **Credentials resent** | Employee's email | Same as above — for when they forget their password |
| 🔑 **Password reset** | Employee's email | New randomly generated password |

### How to set it up (locally)

1. Enable **2-Step Verification** on your Google account: [myaccount.google.com/security](https://myaccount.google.com/security)
2. Create an **App Password**: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   - Select app: **Mail** → Device: **Other** → Name it `AI MSIS`
   - Copy the 16-character password
3. Add to your `backend/.env` file:
   ```
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-16-char-app-password
   ```

> ⚠️ **Live demo note:** The HF Spaces free tier blocks SMTP ports, so emails won't send from the live demo. Run locally for email features.

---

### 💻 Option 2: Run Locally on Your Computer

Follow these steps to run the project on your own machine.

#### Step 1: Install Required Software

| Software | Version | Why you need it | Download Link |
|----------|---------|----------------|---------------|
| **Python** | 3.12 or higher | The backend server runs on Python | [python.org/downloads](https://www.python.org/downloads/) |
| **Git** | Latest | Downloads the code from GitHub | [git-scm.com/downloads](https://git-scm.com/downloads) |
| **VS Code** (or any text editor) | Latest | To edit the `.env` file and code | [code.visualstudio.com](https://code.visualstudio.com/) |
| **Terminal** (Mac/Linux) or **Command Prompt** (Windows) | Built-in | To run commands (clone, start, etc.) | Already on your computer |

> **Windows users:** During Python install, **check** the box ➜ **"Add Python to PATH"**. This is very important — without it, the `python` command won't work in Command Prompt.

> **First time using terminal?** Search YouTube for "Basic Command Prompt tutorial".

#### Step 2: Download the Project

```bash
git clone https://github.com/vikasotageri/Agentic-AI-Employee-Leave-Management.git
cd Agentic-AI-Employee-Leave-Management
```

#### Step 3: Get Your API Keys (Required)

This project needs **3 things** to work fully. Follow the links below to get them:

| # | What you need | Why | How to get it (click link) |
|---|--------------|-----|---------------------------|
| 1 | **OpenAI API Key** | Powers the AI Chat feature — without it, agents won't work | [🔑 Get OpenAI API Key](https://platform.openai.com/api-keys) → Click "Create new secret key" → Copy the `sk-...` key |
| 2 | **Gmail Account** | Sends welcome emails & credentials to new employees | [📧 Create Gmail](https://accounts.google.com/signup) (if you don't have one) |
| 3 | **Gmail App Password** | Lets the system send emails from your Gmail | [🔐 Create App Password](https://myaccount.google.com/apppasswords) → Select "Mail" → Generate → Copy 16-char password |

> **📌 How to get Gmail App Password (step-by-step):**
> 1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
> 2. Sign in with your Gmail
> 3. Under "Select app" → choose **"Mail"**
> 4. Under "Select device" → choose **"Other (Custom name)"** → type `AI MSIS`
> 5. Click **"Generate"**
> 6. Copy the **16-character password** (looks like `abcd efgh ijkl mnop`) — spaces are OK, include them
>
> ❓ Don't see "App Passwords"? Enable **[2-Step Verification](https://myaccount.google.com/security)** first, then come back.

#### Step 4: Set Up Environment Variables

Now put those keys into a file so the system can read them.

```bash
# Create .env file from the template
cp backend/.env.example backend/.env
```

**Where is this file?** Open the `Agentic-AI-Employee-Leave-Management` folder → open `backend` folder → find `.env` file. Open it in **Notepad** (Windows) or **TextEdit** (Mac) or **VS Code**.

**Replace the placeholder text with your actual keys:**

```
OPENAI_API_KEY=sk-your-openai-api-key-here
SECRET_KEY=any-random-string
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
```

| Variable | Required? | What to put | Example |
|----------|-----------|-------------|---------|
| `OPENAI_API_KEY` | ✅ **Required** | Paste the `sk-...` key from OpenAI | `sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz123456` |
| `SECRET_KEY` | ✅ **Required** | Any random text you make up | `mySuperSecretKey123!@#` |
| `SMTP_USER` | ✅ **Required for email** | Your full Gmail address | `vikasotageri234@gmail.com` |
| `SMTP_PASS` | ✅ **Required for email** | The 16-char password from Google | `abcd efgh ijkl mnop` |

> ⚠️ **All four fields are required** for the full system to work. Without OpenAI key → AI Chat won't work. Without SMTP → emails won't send.

**Save the file** (Ctrl+S) and close it.

#### Step 5: Start the Servers

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

#### 🛠️ Troubleshooting

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

## 🎓 Purpose: Educational Project (Not Enterprise)

> ⚠️ **This is a LEARNING project** built to understand **how Agentic AI works** — how LLMs, prompts, tools, and agents work together. It is **not** a production-ready enterprise system.

> 🔑 **This project REQUIRES an OpenAI API key** (for AI Chat feature) and **Gmail credentials** (for email notifications). Both are free to set up — see Step 3 below.

### What This Project Teaches You

| Concept | How It's Demonstrated Here |
|---------|---------------------------|
| **🤖 Agentic AI** | Multiple AI agents (Supervisor + 5 Specialists) that make decisions autonomously |
| **🧠 LLMs (Large Language Models)** | GPT-4o-mini reads user messages and decides what action to take — no if-else chains |
| **📝 Prompt Engineering** | Each agent has a prompt that tells it what to do, what tools it has, and what NOT to do |
| **🔧 AI Tools / Function Calling** | Agents don't guess — they call real database functions (`get_leave_balance`, `apply_leave`, etc.) |
| **🔄 LangGraph Workflows** | Agents are connected in a graph — Supervisor → Specialist → Tool → Response |
| **🚫 No Hardcoding** | The AI understands "Apply for casual leave tomorrow" without parsing keywords. A traditional system would need rigid forms |
| **🔀 Multi-Agent Orchestration** | One supervisor delegates to specialists — like a manager delegating to teams |

### ❌ What This Project Is NOT

- ❌ **Not a replacement for SAP / Oracle / Workday** — those are enterprise-grade systems with 1000s of features
- ❌ **Not security-audited** — no penetration testing, no SOC2, no GDPR compliance
- ❌ **Not scalable** — SQLite (not PostgreSQL), single server (not load-balanced)
- ❌ **Not for production data** — don't put real employee PII here

### ✅ What This Project IS Good For

- ✅ **Learning how AI agents work** — see the full flow: user message → LLM → tool call → response
- ✅ **Understanding LangGraph** — trace how Supervisor routes to Specialists
- ✅ **Experimenting with prompts** — tweak `ai/agents/graphs.py` prompts and see how AI behavior changes
- ✅ **Testing LLM tool calling** — see how OpenAI's function calling integrates with Python
- ✅ **Building your own agentic system** — use this as a template for your own ideas

---

## 💼 Business Scenarios — What AI Can Do vs Traditional Coding

Below are real scenarios showing **why AI agents are powerful** compared to traditional hardcoded logic.

### Scenario 1: Ambiguous Natural Language

| 👤 User says | Traditional System | 🤖 AI Agent (This Project) |
|-------------|-------------------|---------------------------|
| *"I need day after tomorrow off"* | ❌ Would fail — needs exact date format | ✅ Understands "day after tomorrow" → computes date → applies leave |
| *"Can I take Friday off?"* | ❌ Form only accepts dd-mm-yyyy | ✅ Understands "Friday" → finds next Friday → checks policy → applies |
| *"What leaves do I have left?"* | ❌ Must navigate to specific page | ✅ Understands intent → fetches balance → responds in English |
| *"Approve John's sick leave"* | ❌ Must find John in a list, click approve | ✅ Understands → finds John's pending sick leave → approves it |

**Why this matters:** Traditional systems force users to follow rigid menus and forms. AI agents understand **how humans actually talk**.

### Scenario 2: Multi-Step Reasoning

| 👤 User says | 🤖 AI Agent does |
|-------------|-----------------|
| *"Apply for 3 days casual leave from next Monday"* | 1. Figures out next Monday's date<br>2. Checks if casual leave allows 3 days at once<br>3. Checks monthly limit (2/month)<br>4. If 1st/2nd request → auto-approves. If 3rd → routes to manager<br>5. Returns result in plain English |
| *"Who's on leave this week?"* | 1. Determines current week dates<br>2. Queries all leaves in that range<br>3. Groups by employee<br>4. Returns: "John (casual, Mon-Wed), Sarah (sick, Tue)" |

**Why this matters:** A traditional system would need separate pages/APIs for each step. The AI agent chains multiple tool calls together based on what the user needs.

### Scenario 3: Policy Handling Without Hardcoding

| Approach | How it works |
|----------|-------------|
| **Traditional code** | Rules are hardcoded: `if leave_type == "casual" and count > 2: requires_approval()` — changing policy means changing code, redeploying |
| **AI Agent** | Policy is written in plain English in the prompt: *"First 2 casual requests/month auto-approved. 3rd+ → manager."* — changing policy means editing text, no code change |

**Example:** If the company changes policy from "2 casual leaves/month" to "3 casual leaves/month":
- **Traditional:** Find and update the if-condition in the code → re-deploy
- **AI Agent:** Edit one sentence in the prompt → restart server

### Scenario 4: Cross-Domain Questions

| Question | What the AI does |
|----------|-----------------|
| *"How many leaves did I take this year?"* | Queries leave records, counts by type, sums up |
| *"Show me everyone who joined this month"* | Filters employees by DOJ range |
| *"Who has the most remaining casual leave?"* | Calculates all balances, sorts descending, returns top |
| *"What's the policy on sick leave?"* | Reads policy prompt, explains in simple words |

**Why this matters:** Each question would need a separate API endpoint in a traditional system. Here, one AI + tools handles infinite question types.

### Scenario 5: Graceful Handling of Unknown Requests

| User says | Traditional System | AI Agent |
|-----------|-------------------|----------|
| *"Tell me a joke"* | ❌ Error / 404 | ✅ "I'm a leave management assistant — I can help with leaves, policies, and reports!" |
| *"What's the weather?"* | ❌ Error | ✅ "I don't have access to weather data. I can help with leave-related questions." |
| *"Translate hello to French"* | ❌ Error | ✅ Tells user what it CAN do |

**Why this matters:** Traditional systems crash or show errors on unexpected input. AI agents **know their boundaries** and guide users appropriately.

---

## 🔍 How Each Concept Maps to Code

| Concept | File | What to Look At |
|---------|------|----------------|
| **Prompt Engineering** | `ai/agents/graphs.py` | Each agent's prompt (LEAVE_PROMPT, APPROVAL_PROMPT, etc.) — plain English instructions |
| **Tool Definitions** | `ai/agents/tools.py` | Functions decorated with `@tool` — these are the "actions" agents can take |
| **Tool Schemas** | `ai/agents/supervisor.py` | How tools are described to the LLM (name, description, parameters) |
| **Agent Graph** | `ai/agents/graphs.py` | How agents connect — `StateGraph` with nodes and edges |
| **Supervisor Routing** | `ai/agents/supervisor.py` | `classify_intent()` — LLM decides which specialist handles the request |
| **LLM Call** | `ai/agents/supervisor.py` | `bind_tools()` — connects OpenAI function calling to Python functions |

---

## 📁 Project Structure

```
Agentic-AI-Employee-Leave-Management/
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
├── screenshots/                       # Portal screenshots
│   ├── employee.png
│   ├── manager.png
│   └── hr.png
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

This project needs **4 environment variables** to work fully:

| Variable | Required | Description | Where to get it |
|----------|----------|-------------|-----------------|
| `OPENAI_API_KEY` | ✅ **Required** | OpenAI API key for AI Chat agents | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `SECRET_KEY` | ✅ **Required** | JWT secret — any random string for login security | Make up any text (e.g. `mySecretKey123`) |
| `SMTP_USER` | ✅ **Required for email** | Gmail address that sends welcome emails | Your Gmail address |
| `SMTP_PASS` | ✅ **Required for email** | Gmail app password (16 chars) | [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) |

### How to set them:

Edit `backend/.env` file (see [Step 4](#step-4-set-up-environment-variables))

> ❓ **Don't have a Gmail App Password?** Follow the steps above to create one.

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
🎓 **M.C.A.** — Master of Computer Applications  
🎓 Currently Student at **Manipal School of Information Science, Manipal**

[![GitHub](https://img.shields.io/badge/GitHub-vikasotageri-181717?logo=github)](https://github.com/vikasotageri)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-vikasotageri-0A66C2?logo=linkedin)](https://www.linkedin.com/in/vikasotageri/)
[![Email](https://img.shields.io/badge/Email-vikasotageri234@gmail.com-EA4335?logo=gmail)](mailto:vikasotageri234@gmail.com)
[![Email](https://img.shields.io/badge/Email-vikas1.msismpl2025@learner.manipal.edu-0078D4?logo=microsoft-outlook)](mailto:vikas1.msismpl2025@learner.manipal.edu)

---

<div align="center">
  <strong>⭐ Star this repo if you found it useful!</strong>
</div>
