import os
from fastapi import APIRouter
from pydantic import BaseModel
from agents.graphs import build_employee_graph, build_manager_graph, build_hr_graph

router = APIRouter(prefix="/api/chat", tags=["chat"])

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
    user = {"id": req.user_id, "name": req.user_name, "role": req.user_role}

    # Restore conversation history from client if server memory is empty
    from ai_engine.agent_memory import conversation_memory
    existing = conversation_memory.get(req.user_id)
    if not existing and req.history:
        for h in req.history[-10:]:
            role = h.get("role", "user")
            content = h.get("content", "")
            if role in ("user", "assistant"):
                conversation_memory.add(req.user_id, role, content)

    if not os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY") == "sk-your-openai-api-key-here":
        return {"response": "❌ **OpenAI API Key Required**\n\nSet `OPENAI_API_KEY` in `/backend/.env` then restart the server."}

    try:
        graph = employee_graph
        if req.user_role == "manager":
            graph = manager_graph
        elif req.user_role == "hr":
            graph = hr_graph

        result = await graph.ainvoke(
            {"messages": [{"role": "user", "content": req.message}], "user": user, "agent_response": None, "next": None, "active_agent": None},
        )

        return {"response": result.get("agent_response", "I processed your request.")}
    except Exception as e:
        print(f"Chat error: {e}")
        return {"response": fallback_chat(req.message, user)}


def fallback_chat(message: str, user: dict) -> str:
    from openai import OpenAI
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": f"You are a {user.get('role')} AI Assistant for a Leave Management System. User: {user.get('name')} ({user.get('id')}). Answer helpfully using your knowledge."},
                {"role": "user", "content": message},
            ],
            max_tokens=1000,
        )
        return resp.choices[0].message.content or "I'm not sure how to respond."
    except Exception as e:
        return f"Error: {str(e)}"
