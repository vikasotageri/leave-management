"""
================================================================================
 LEAVE FLOW — Chat API Router
================================================================================

 PURPOSE:
  Handles the POST /api/chat endpoint for AI-powered conversational assistant.
  Routes user messages to the correct role-based LangGraph StateGraph,
  runs the agent pipeline, and returns the AI response.

 CALLED BY:
  - frontend/static/js/chat.js (line 30+): sendChat() function
      → Sends POST /api/chat with {message, user_id, user_name, user_role, history}

 WHERE IT FITS (BACKEND FLOW):
  POST /api/chat
    → chat.py selects graph by user_role
    → graph.ainvoke() → supervisor.classify_intent() → specialist agent
    → Returns {"response": "..."}
  Fallback: If LangGraph fails, calls fallback_chat() (direct GPT-4o-mini)

 ROUTE:
  POST /api/chat

 REQUEST BODY:
  {
    "message": "What is my leave balance?",
    "user_id": "EMP001",
    "user_name": "John Doe",
    "user_role": "employee",
    "history": [{"role": "user", "content": "..."}, ...]
  }

 RESPONSE:
  {"response": "You have 12 sick days remaining."}
================================================================================
"""

import os
from fastapi import APIRouter
from pydantic import BaseModel
from ai.agents.graphs import build_employee_graph, build_manager_graph, build_hr_graph

router = APIRouter(prefix="/api/chat", tags=["chat"])

# Build role-specific LangGraph StateGraphs at module load time
employee_graph = build_employee_graph()
manager_graph = build_manager_graph()
hr_graph = build_hr_graph()


class ChatRequest(BaseModel):
    message: str
    user_id: str
    user_name: str
    user_role: str
    history: list = []


@router.post("")
async def chat(req: ChatRequest):
    """
    Main chat endpoint. Routes to LangGraph or fallback.

    FLOW:
      1. Build user dict from request
      2. Restore conversation history from client (if server memory is empty)
      3. Check for OPENAI_API_KEY
      4. Select graph by user_role
      5. Invoke graph.ainvoke() with user message + user context
      6. Return agent_response or fallback

    HISTORY RESTORE:
      If the server was restarted (in-memory agent_memory lost), the client
      sends the last N messages which are re-added to conversation_memory.
    """
    user = {"id": req.user_id, "name": req.user_name, "role": req.user_role}

    # Restore conversation history from client if server memory is empty
    from ai.engine.agent_memory import conversation_memory
    existing = conversation_memory.get(req.user_id)
    if not existing and req.history:
        for h in req.history[-10:]:
            role = h.get("role", "user")
            content = h.get("content", "")
            if role in ("user", "assistant"):
                conversation_memory.add(req.user_id, role, content)

    # API key check
    if not os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY") == "sk-your-openai-api-key-here":
        return {"response": "❌ **OpenAI API Key Required**\n\nSet `OPENAI_API_KEY` in `/backend/.env` then restart the server."}

    try:
        # Select the role-specific graph
        graph = employee_graph
        if req.user_role == "manager":
            graph = manager_graph
        elif req.user_role == "hr":
            graph = hr_graph

        # Run the LangGraph StateGraph
        result = await graph.ainvoke(
            {
                "messages": [{"role": "user", "content": req.message}],
                "user": user,
                "agent_response": None,
                "next": None,
                "active_agent": None,
            },
        )

        return {"response": result.get("agent_response", "I processed your request.")}

    except Exception as e:
        print(f"Chat error: {e}")
        return {"response": fallback_chat(req.message, user)}


def fallback_chat(message: str, user: dict) -> str:
    """
    Fallback handler when LangGraph pipeline fails.
    Calls GPT-4o-mini directly with role-specific rules and plain-text output.
    """
    role = (user.get("role") or "employee").lower()
    if role == "employee":
        import re
        other_ids = re.findall(r'(?:^|\s)(EMP\d{3})(?:\s|$|[.\?,!])', message)
        caller_id = user.get("id", "")
        for oid in other_ids:
            if oid != caller_id:
                return f"Access denied: you can only view your own data (EMP ID: {caller_id})."
        if any(kw in message.lower() for kw in ["tag me", "tag my", "assign project", "change project", "tag in project", "assign me", "give me project"]):
            return "Only HR or your manager can change project tags."

    rule_text = {
        "employee": "Answer only about the logged-in employee's own leave data. Never reveal other employees' details.",
        "manager": "Answer only about your team members' leave data.",
        "hr": "You may answer HR/admin questions about any employee.",
    }.get(role, "Answer helpfully about leave management.")

    from openai import OpenAI
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are a {role} AI Assistant for a Leave Management System. "
                        f"User: {user.get('name')} ({user.get('id')}). "
                        f"{rule_text} "
                        f"OUTPUT FORMAT: plain text only. 1-3 lines. NO markdown, NO bullets, NO bold, NO emoji."
                    ),
                },
                {"role": "user", "content": message},
            ],
            max_tokens=250,
        )
        return resp.choices[0].message.content or "I'm not sure how to respond."
    except Exception as e:
        return f"Error: {str(e)}"
