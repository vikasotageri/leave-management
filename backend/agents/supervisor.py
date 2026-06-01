import os
import json
from openai import OpenAI
from dotenv import load_dotenv
from agents.tools import TOOL_MAP
from ai_engine.vector_store import seed_policy_vector_store
from ai_engine.rag import RagPipeline
from ai_engine.agent_memory import conversation_memory

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

_rag = None
_vector_store = None


def get_rag():
    global _rag
    if _rag is None:
        _rag = RagPipeline()
    return _rag


def get_vector_store():
    global _vector_store
    if _vector_store is None:
        _vector_store = seed_policy_vector_store()
    return _vector_store


def _tool(name, desc, props, required):
    return {"type": "function", "function": {"name": name, "description": desc, "parameters": {"type": "object", "properties": props, "required": required}}}


TOOL_SCHEMAS = [
    _tool("get_leave_balance", "Get employee leave balance", {"employee_id": {"type": "string"}}, ["employee_id"]),
    _tool("get_leave_history", "Get last 10 leave records", {"employee_id": {"type": "string"}}, ["employee_id"]),
    _tool("get_upcoming_leaves", "Get upcoming leaves", {"employee_id": {"type": "string"}}, ["employee_id"]),
    _tool("apply_leave", "Apply for leave. Dates must be in YYYY-MM-DD format. Reason is not required but the user should be told it was applied without one.", {"employee_id": {"type": "string"}, "type": {"type": "string", "enum": ["sick", "casual", "business", "emergency", "family", "paid", "unpaid"]}, "start_date": {"type": "string"}, "end_date": {"type": "string"}, "reason": {"type": "string"}}, ["employee_id", "type", "start_date", "end_date"]),
    _tool("cancel_leave", "Cancel a leave. Reason is optional for pending/rejected leaves (will be hard-deleted). For approved leaves, reason is required.", {"leave_id": {"type": "string"}, "reason": {"type": "string"}}, ["leave_id"]),
    _tool("get_pending_requests", "Get pending leaves for manager", {"manager_id": {"type": "string"}}, ["manager_id"]),
    _tool("approve_leave", "Approve a leave", {"leave_id": {"type": "string"}}, ["leave_id"]),
    _tool("reject_leave", "Reject a leave", {"leave_id": {"type": "string"}, "reason": {"type": "string"}}, ["leave_id", "reason"]),
    _tool("get_cancellation_requests", "Get cancellation requests", {"manager_id": {"type": "string"}}, ["manager_id"]),
    _tool("approve_cancellation", "Approve cancellation", {"leave_id": {"type": "string"}}, ["leave_id"]),
    _tool("reject_cancellation", "Reject cancellation", {"leave_id": {"type": "string"}}, ["leave_id"]),
    _tool("check_team_availability", "Check team availability on date", {"manager_id": {"type": "string"}, "date": {"type": "string"}}, ["manager_id", "date"]),
    _tool("get_leave_policy", "Get company leave policy", {}, []),
    _tool("get_team_leave_stats", "Get team leave stats", {"manager_id": {"type": "string"}, "period": {"type": "string", "enum": ["today", "week", "month", "all"]}}, ["manager_id"]),
    _tool("get_employee_leave_detail", "Get detailed employee info by ID", {"employee_id": {"type": "string"}}, ["employee_id"]),
    _tool("get_all_employees", "Get list of all employees", {}, []),
    _tool("get_employee_by_id", "Get detailed employee info", {"employee_id": {"type": "string"}}, ["employee_id"]),
    _tool("get_hr_contact", "Get HR contact information", {}, []),
    _tool("get_manager_info", "Get manager info for employee", {"employee_id": {"type": "string"}}, ["employee_id"]),
    _tool("search_policy", "Semantic search company leave policies using vector embeddings", {"query": {"type": "string"}}, ["query"]),
    _tool("rag_query", "Answer using RAG on policy knowledge base", {"question": {"type": "string"}}, ["question"]),
    _tool("get_conversation_history", "Get recent conversation history", {"user_id": {"type": "string"}}, ["user_id"]),
    _tool("get_leave_by_id", "Get full details of a specific leave request by its ID", {"leave_id": {"type": "string"}}, ["leave_id"]),
]


def classify_intent(message: str, user: dict, agents: list) -> str:
    descriptions = "\n".join(f'{i+1}. "{a["name"]}" - {a["description"]}' for i, a in enumerate(agents))
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": f"Route user messages to the correct agent. Available agents:\n{descriptions}\n\nUser role: {user.get('role')}\nRespond with ONLY the exact agent name.",
                },
                {"role": "user", "content": message},
            ],
            max_tokens=30,
            temperature=0.1,
        )
        agent_name = response.choices[0].message.content.strip()
        matched = next((a["name"] for a in agents if a["name"] == agent_name), agents[0]["name"])
        return matched
    except Exception as e:
        print(f"Supervisor error: {e}")
        return agents[0]["name"]


def call_agent_with_tools(system_prompt: str, user_message: str, user: dict, db, tool_schemas: list) -> str:
    user_context = f"\n\nCurrent user: {user.get('name')} (ID: {user.get('id')}, Role: {user.get('role')})"

    history = conversation_memory.get_formatted(user.get("id", ""))
    rag_context = ""
    try:
        rag_result = get_rag().query(user_message)
        if rag_result.get("answer"):
            rag_context = f"\n\nRAG Policy Context:\n{rag_result['answer']}"
    except Exception:
        pass

    messages = [
        {"role": "system", "content": system_prompt + user_context + rag_context + f"\n\nConversation History:\n{history}"},
        {"role": "user", "content": user_message},
    ]

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        tools=tool_schemas,
        tool_choice="auto",
        max_tokens=1200,
    )

    msg = response.choices[0].message

    if not msg.tool_calls:
        reply = msg.content or "I processed your request."
        conversation_memory.add(user.get("id", ""), "user", user_message)
        conversation_memory.add(user.get("id", ""), "assistant", reply)
        return reply

    messages.append(msg)

    max_rounds = 5
    for _ in range(max_rounds):
        tool_results = []
        for tc in msg.tool_calls:
            args = json.loads(tc.function.arguments)
            tool_fn = TOOL_MAP.get(tc.function.name)
            if tool_fn:
                try:
                    result = tool_fn(db, args)
                except Exception as e:
                    result = {"success": False, "error": str(e)}
                tool_results.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(result)})
            else:
                tool_results.append({"role": "tool", "tool_call_id": tc.id, "content": f"Unknown tool: {tc.function.name}"})

        messages.extend(tool_results)

        final = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=tool_schemas,
            tool_choice="auto",
            max_tokens=1200,
        )

        msg = final.choices[0].message

        if not msg.tool_calls:
            reply = msg.content or "Done."
            messages.append(msg)
            conversation_memory.add(user.get("id", ""), "user", user_message)
            conversation_memory.add(user.get("id", ""), "assistant", reply)
            return reply

        messages.append(msg)

    reply = "I processed your request."
    conversation_memory.add(user.get("id", ""), "user", user_message)
    conversation_memory.add(user.get("id", ""), "assistant", reply)
    return reply
