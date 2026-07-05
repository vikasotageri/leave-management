---
title: MSIS Leave Management System
emoji: 📋
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
---

# MSIS Leave Management System

Multi-role AI-powered Leave Management System with Employee, Manager, and HR portals.

## 🔗 Live Demo

Deployed on Hugging Face Spaces.

| Portal | URL |
|--------|-----|
| Employee | `/employee` |
| Manager | `/manager` |
| HR | `/hr` |

## Features

- **Employee Portal** — Apply leaves, view balance, AI chat assistant
- **Manager Portal** — Approve/reject leaves, manage team, AI assistant
- **HR Portal** — Create employees, manage all records, AI assistant
- **AI Chat** — LangGraph-powered AI for each role
- **Email Notifications** — SMTP integration for credentials & alerts

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Python FastAPI |
| AI | LangGraph + OpenAI GPT-4o-mini |
| Database | SQLite / PostgreSQL |
| Frontend | Vanilla JS + TailwindCSS |
| Auth | JWT (python-jose + bcrypt) |

## Environment Variables

Set these in Hugging Face Spaces → Settings → Repository Secrets:

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | ✅ Yes | OpenAI API key for AI chat |
| `SECRET_KEY` | ✅ Yes | JWT secret key |
| `SMTP_USER` | ❌ No | Gmail for sending emails |
| `SMTP_PASS` | ❌ No | Gmail app password |
| `DATABASE_URL` | ❌ No | Defaults to SQLite |

## Run Locally

```bash
# 1. Clone
git clone <repo>
cd leave-management

# 2. Set up env
cp backend/.env.example backend/.env
# Edit backend/.env with your keys

# 3. Run
bash start.sh
```

## Credentials (seeded)

| Role | Email | Password |
|------|-------|----------|
| HR | hr@company.com | pass123 |
| Manager | manager@company.com | pass123 |
