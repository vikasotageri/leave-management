"""
================================================================================
 LEAVE FLOW — LangGraph Supervisor Agent
================================================================================

 PURPOSE:
  Acts as the "brain" that routes user messages to the right specialist agent.
  Uses GPT-4o-mini to classify intent, then dispatches to the correct handler.

 CALLED BY:
  - backend/routers/chat.py (line 37): process_with_supervisor()
      → Called on every POST /api/chat request
      → Runs the full LangGraph StateGraph through supervisor.py:run_supervisor()

 WHERE IT FITS (AI FLOW):
  User types message → POST /api/chat
    → chat.py → run_supervisor(message, user_id, role)
      → supervisor.py classify_intent() → decides which agent to use
        → "Leave Agent"     → tools.ask_leave_assistant()
        → "Leave Status"    → tools.get_user_leaves()
        → "Payroll Agent"   → tools.payroll_query()
        → "Policy Agent"    → tools.get_policy_answer()
        → "Manager Approval" → tools.get_pending_leaves() / tools.approve_leave()
        → "General"         → tools.general_query()
      → Returns {"messages": [response_text]}
    → chat.py returns JSON to frontend

 STATE GRAPH DESIGN:
  - State: TypedDict with keys: messages (list), user_id, role, next_agent
  - Nodes: classify_node, agent_node, final_node
  - Edges: classify → agent → final (sequential)
  - Conditional: if "tools" appears in agent response, it calls the tool instead

 DEPENDENCIES:
  - openai (GPT-4o-mini for intent classification)
  - langgraph (StateGraph for orchestration)
  - ai.agents.tools (specialist agent handlers)
  - ai.engine.agent_memory (conversation_memory for history)
================================================================================
"""

import os
import json
from typing import TypedDict, Literal
from dotenv import load_dotenv
from openai import OpenAI
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage
from ai.agents.tools import TOOLS
from ai.engine.agent_memory import conversation_memory
from ai.agents.tools import (
    ask_leave_assistant, get_user_leaves, payroll_query,
    get_policy_answer, get_pending_leaves, approve_leave_agent,
    reject_leave_agent, get_employee_details, general_query,
    get_agent_memory, get_cancellation_status, hr_override
)

load_dotenv()

# -------------------------------------------------------------------
# Environment & OpenAI Client (lazy)
# -------------------------------------------------------------------
def _get_client():
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

GPT_MODEL = "gpt-4o-mini"

# -------------------------------------------------------------------
# System Prompt for Intent Classification
# -------------------------------------------------------------------
SYSTEM_PROMPT = """You are a leave management assistant. Classify the user's intent into one of these agents:

- "Leave Agent": User wants to APPLY for leave. Keywords: apply, take, book, schedule, request leave.
- "Leave Status": User wants to CHECK their leave status or balance. Keywords: balance, remaining, status, how many days left.
- "Payroll Agent": User asks about salary, payroll, pay, compensation.
- "Policy Agent": User asks about company policy, rules, regulations.
- "Manager Approval": User is a manager approving/rejecting leaves.
- "General": For greetings, thanks, small talk, casual conversation.

Respond ONLY with the agent name. No explanation."""

# -------------------------------------------------------------------
# State Graph Definition
# -------------------------------------------------------------------

class AgentState(TypedDict):
    """State type for the LangGraph StateGraph.
    
    Attributes:
        messages:  Chat message history (list of strings)
        user_id:   Employee ID (e.g., "EMP001")
        role:      User role ("employee", "manager", "hr")
        next_agent: One of the 7 agent types above
    """
    messages: list
    user_id: str
    role: str
    next_agent: str


def _classify_intent_node(state: AgentState) -> AgentState:
    """
    Node: Classify user intent using GPT-4o-mini.
    Reads the last user message and determines which agent should handle it.
    
    FLOW:
      1. Build messages array (system prompt + conversation history + last user message)
      2. Send to GPT-4o-mini with temperature 0 (deterministic)
      3. Parse response as one of the 7 agent types
      4. Set state["next_agent"] accordingly
      5. Fallback to "General" if parsing fails
    """
    last_user_msg = state["messages"][-1] if state["messages"] else ""
    history = conversation_memory.get_formatted(state["user_id"])
    
    response = _get_client().chat.completions.create(
        model=GPT_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "system", "content": f"Conversation history:\n{history}"},
            {"role": "user", "content": last_user_msg}
        ],
        temperature=0,
        max_tokens=50,
    )
    state["next_agent"] = (response.choices[0].message.content or "General").strip()
    return state


def agent_node(state: AgentState) -> AgentState:
    """
    Node: Route to the appropriate specialist agent based on classification.
    
    Dispatches to the correct tool function based on state["next_agent"].
    Each tool function returns a response string that is appended to messages.
    """
    agent_map = {
        "Leave Agent": ask_leave_assistant,
        "Leave Status": get_user_leaves,
        "Payroll Agent": payroll_query,
        "Policy Agent": get_policy_answer,
        "Manager Approval": _manager_approval_handler,
        "General": general_query,
    }
    
    handler = agent_map.get(state["next_agent"], general_query)
    result = handler(state["messages"][-1] if state["messages"] else "", state["user_id"], state["role"])
    
    if "via_tool" in str(result).lower() or isinstance(result, dict) and result.get("tool"):
        # If the handler indicates a tool should be called, route to tool execution
        return _tool_execution_node(state)
    
    state["messages"].append(result if isinstance(result, str) else str(result))
    # Save to conversation memory
    conversation_memory.add(state["user_id"], "assistant", state["messages"][-1])
    return state


def final_node(state: AgentState) -> AgentState:
    """
    Node: Final processing before returning response to user.
    Currently a pass-through — could add response formatting or logging.
    """
    return state


def _manager_approval_handler(message: str, user_id: str, role: str) -> str:
    """
    Handle manager approval/rejection intent.
    Routes to either get_pending_leaves (view) or approve/reject based on message content.
    """
    msg_lower = message.lower()
    if "approve" in msg_lower:
        return approve_leave_agent(message, user_id, role)
    elif "reject" in msg_lower:
        return reject_leave_agent(message, user_id, role)
    else:
        return get_pending_leaves(message, user_id, role)


def _tool_execution_node(state: AgentState) -> AgentState:
    """
    Node: Execute a specific tool function when the handler needs to
    look up data (balance, pending leaves, etc.) before responding.
    """
    agent = state["next_agent"]
    msg = state["messages"][-1]
    uid = state["user_id"]
    role = state["role"]
    
    tool_results = {
        "Leave Status": lambda: _get_leave_balance(msg, uid, role),
        "Manager Approval": lambda: get_pending_leaves(msg, uid, role),
    }
    
    result = tool_results.get(agent, lambda: "I couldn't process that request.")()
    state["messages"][0] = result if isinstance(result, str) else str(result)
    conversation_memory.add(uid, "assistant", state["messages"][0])
    return state


def _get_leave_balance(message: str, user_id: str, role: str) -> str:
    """Get formatted leave balance for the user."""
    from ai.agents.tools import get_leave_balance_details
    return get_leave_balance_details(user_id)


# -------------------------------------------------------------------
# Build the LangGraph StateGraph
# -------------------------------------------------------------------
workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("classify", _classify_intent_node)
workflow.add_node("agent", agent_node)
workflow.add_node("final", final_node)

# Set entry point
workflow.set_entry_point("classify")

# Add edges: classify → agent → final
workflow.add_edge("classify", "agent")
workflow.add_edge("agent", "final")
workflow.add_edge("final", END)

# Compile the graph
app_graph = workflow.compile()


# ======================================================================
# ORIGINAL FUNCTIONS (used by graphs.py / chat.py)
# ======================================================================

_lc_model = ChatOpenAI(model="gpt-4o-mini", api_key=os.getenv("OPENAI_API_KEY"))


def _role_tools(role: str):
    """Return a limited tool set for the current role."""
    names_by_role = {
        "employee": {
            "get_leave_balance",
            "get_leave_history",
            "get_leave_by_date",
            "get_upcoming_leaves",
            "apply_leave",
            "cancel_leave",
            "get_leave_policy",
            "rag_query",
            "search_policy",
            "get_conversation_history",
            "get_employee_leave_summary",
            "get_my_profile",
            "get_hr_contact",
            "get_manager_info",
        },
        "manager": {
            "get_leave_balance",
            "get_leave_history",
            "get_leave_by_date",
            "get_upcoming_leaves",
            "apply_leave",
            "cancel_leave",
            "get_pending_requests",
            "approve_leave",
            "reject_leave",
            "get_cancellation_requests",
            "approve_cancellation",
            "reject_cancellation",
            "check_team_availability",
            "get_team_leave_stats",
            "get_employee_leave_detail",
            "get_employee_by_id",
            "get_leave_policy",
            "rag_query",
            "search_policy",
            "get_conversation_history",
            "get_leave_by_id",
            "get_employee_leave_summary",
            "get_my_profile",
            "get_hr_contact",
            "get_manager_info",
            "get_team_members",
            "approve_leave_by_employee",
            "reject_leave_by_employee",
        },
        "hr": {
            "get_leave_balance",
            "get_leave_history",
            "get_leave_by_date",
            "get_upcoming_leaves",
            "apply_leave",
            "cancel_leave",
            "get_pending_requests",
            "approve_leave",
            "reject_leave",
            "get_cancellation_requests",
            "approve_cancellation",
            "reject_cancellation",
            "check_team_availability",
            "get_team_leave_stats",
            "get_employee_leave_detail",
            "get_all_employees",
            "get_employee_by_id",
            "get_hr_contact",
            "get_manager_info",
            "get_leave_policy",
            "rag_query",
            "search_policy",
            "get_conversation_history",
            "get_leave_by_id",
            "get_employee_leave_summary",
            "get_my_profile",
        },
    }
    allowed = names_by_role.get((role or "employee").lower(), names_by_role["employee"])
    return [tool for tool in TOOLS if tool.name in allowed]


def classify_intent(message: str, user: dict, agents: list) -> str:
    """
    Original intent classifier (used by graphs.py).
    Routes user messages to the correct agent from a list.

    Args:
        message: User's message text
        user:    User dict {id, name, role}
        agents:  List of agent dicts [{name, prompt, description}]

    Returns:
        Name of the matched agent (string)
    """
    descriptions = "\n".join(f'{i+1}. "{a["name"]}" - {a["description"]}' for i, a in enumerate(agents))
    try:
        response = _lc_model.invoke(
            [SystemMessage(content=f"Route user messages to the correct agent. Available agents:\n{descriptions}\n\nUser role: {user.get('role')}\nRespond with ONLY the exact agent name."),
             HumanMessage(content=message)],
            temperature=0.1, max_tokens=30,
        )
        agent_name = response.content.strip()
        matched = next((a["name"] for a in agents if a["name"] == agent_name), agents[0]["name"])
        return matched
    except Exception as e:
        print(f"Supervisor error: {e}")
        return agents[0]["name"]


def call_agent_with_tools(system_prompt: str, user_message: str, user: dict) -> str:
    """
    Original agent-with-tools caller (used by graphs.py).
    Binds tools to the LLM and handles up to 5 rounds of tool calling.

    Args:
        system_prompt: Agent system prompt
        user_message:  The user's message
        user:          User dict {id, name, role}

    Returns:
        Response string from the LLM
    """
    msg_lower = user_message.lower()
    role = (user.get("role") or "employee").lower()

    # Hard guard: employee asking about other employees by ID
    if role == "employee":
        import re
        other_ids = re.findall(r'(?:^|\s)(EMP\d{3})(?:\s|$|[.\?,!])', user_message)
        if other_ids:
            caller_id = user.get("id", "")
            for oid in other_ids:
                if oid != caller_id:
                    err_msg = f"Access denied: you can only view your own data (EMP ID: {caller_id})."
                    conversation_memory.add(user.get("id", ""), "user", user_message)
                    conversation_memory.add(user.get("id", ""), "assistant", err_msg)
                    return err_msg

    # Hard guard: employee project tagging (only blocks CHANGE requests, not query)
    if role == "employee" and any(kw in msg_lower for kw in ["tag me", "tag my", "assign project", "change project", "tag in project", "assign me", "give me project"]):
        err_msg = "Only HR or your manager can change project tags."
        conversation_memory.add(user.get("id", ""), "user", user_message)
        conversation_memory.add(user.get("id", ""), "assistant", err_msg)
        return err_msg

    from datetime import date as dt_date
    user_context = f"\n\nCurrent user: {user.get('name')} (ID: {user.get('id')}, Role: {user.get('role')})"
    user_context += f"\nToday's date: {dt_date.today().strftime('%Y-%m-%d')} (YYYY-MM-DD). Use this to determine past vs upcoming pending leaves."
    history = conversation_memory.get_formatted(user.get("id", ""))
    role_rules = {
        "employee": (
            "CRITICAL: You MUST use tools whenever the user asks about leave data, balances, history, profiles, or personal details. Never answer from your training data or conversation context. Call the relevant tool first, then answer based on the tool's output. "
            "Rules: answer only about the logged-in employee's own data. "
            "You CAN show the user's own personal details (name, ID, email, phone, gender, DOB, DOJ, etc.). "
            "Never reveal other employees' personal details. "
            "Project tags: only HR or manager can change them. "
            "Applying leave: ask for leave TYPE and REASON first. If reason clearly matches different type (e.g. 'sick' for casual), ask user if they want that type instead. Then call apply_leave. "
            "Cancelling: call cancel_leave(date=YYYY-MM-DD) directly with the user's date. Tool finds leave by date automatically. "
            "If approved, ask reason first then call cancel_leave(date, reason) again. "
            "Pending -> auto deleted. Approved -> auto set to cancellation_requested. "
            "OUTPUT: plain text only, 1-3 lines. NO markdown, NO bullets, NO bold, NO emoji."
        ),
        "manager": (
            "CRITICAL: You MUST use tools to look up team data. Never answer from training data. "
            "Rules: you may answer about your team only. "
            "Use get_team_members to list team members. Filter results by designation, project_tag, or gender fields. "
            "Use get_employee_by_id to get specific employee details. "
            "Use get_pending_requests to see pending leaves. To split past vs upcoming: check each leave's start_date against today's date (given below). Past = start_date before today. Upcoming = start_date today or later. "
            "Use get_cancellation_requests for cancellation count. "
            "For approve/reject by employee+date: use approve_leave_by_employee(employee_id, date) or reject_leave_by_employee(employee_id, date, reason). "
            "Never guess employee names, IDs, or counts from conversation context — always call a tool. "
            "OUTPUT: plain text only. NO markdown, NO bullets, NO bold, NO emoji. "
            "Keep replies short and action-oriented."
        ),
        "hr": (
            "CRITICAL: You MUST use tools to look up employee data. Never answer from training data. "
            "Rules: you may answer HR/admin employee questions. "
            "OUTPUT: plain text only. NO markdown, NO bullets, NO bold, NO emoji. "
            "Keep replies short and factual."
        ),
    }
    tools = _role_tools(role)
    model_with_tools = _lc_model.bind_tools(tools)

    from ai.agents.tools import set_ai_context
    set_ai_context(user.get("id"), role)

    try:
        messages = [
            SystemMessage(content=system_prompt + "\n\n" + role_rules.get(role, role_rules["employee"]) + user_context + f"\n\nConversation History:\n{history}"),
            HumanMessage(content=user_message),
        ]

        result = model_with_tools.invoke(messages)

        max_rounds = 5
        for _ in range(max_rounds):
            if not result.tool_calls:
                break

            messages.append(result)
            for tc in result.tool_calls:
                tool = next((t for t in tools if t.name == tc["name"]), None)
                if tool:
                    try:
                        output = tool.invoke(tc["args"])
                    except Exception as e:
                        output = {"success": False, "error": str(e)}
                else:
                    output = {"error": f"Unknown tool: {tc['name']}"}
                content = json.dumps(output) if isinstance(output, dict) else str(output)
                messages.append(ToolMessage(content=content, tool_call_id=tc["id"]))

            result = model_with_tools.invoke(messages)

        reply = result.content or "I processed your request."
        conversation_memory.add(user.get("id", ""), "user", user_message)
        conversation_memory.add(user.get("id", ""), "assistant", reply)
        return reply
    finally:
        set_ai_context(None, None)


def run_supervisor(user_message: str, user_id: str, role: str) -> dict:
    """
    Main entry point called by backend/routers/chat.py.
    
    Args:
        user_message: The text message from the user
        user_id:      Employee ID
        role:         User role (employee/manager/hr)
    
    Returns:
        dict with "messages" key containing list of response strings
    
    FLOW:
      1. Save user message to conversation memory
      2. Initialize state with message, user_id, role
      3. Run the compiled StateGraph (classify → agent → final)
      4. Return the final state (messages list)
    """
    conversation_memory.add(user_id, "user", user_message)
    
    initial_state: AgentState = {
        "messages": [user_message],
        "user_id": user_id,
        "role": role,
        "next_agent": "",
    }
    
    final_state = app_graph.invoke(initial_state)
    return {"messages": final_state["messages"]}
