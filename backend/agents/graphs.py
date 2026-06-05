from typing import TypedDict, Optional
from langgraph.graph import StateGraph, END, START
from agents.supervisor import classify_intent, call_agent_with_tools


class AgentState(TypedDict):
    messages: list
    user: dict
    agent_response: Optional[str]
    next: Optional[str]
    active_agent: Optional[str]


# ---- Prompts ----
LEAVE_PROMPT = """You are the Leave Manager Agent — an AI assistant for leave management. You help employees with:
1. Applying for leave (sick, casual, emergency)
2. Cancelling leave requests
3. Checking leave status and history
4. Viewing upcoming/pending leaves

When applying for leave, confirm details before proceeding. When cancelling, explain the implications.
Be professional, concise, and helpful. Use the tools available to you to fulfill the user's request."""

POLICY_PROMPT = """You are the Policy Agent — an AI assistant for company leave policy. Explain leave policy clearly:
- Casual: Max 24/year, 2/month from DOJ (carried forward). First 2 requests/month auto-approved (max 2 days at a time). 3rd+ or >2 days → manager.
- Sick: Max 12/year (no carry forward). First 1 request/month auto-approved (max 1 day). 2nd+ or >1 day → manager.
- Emergency: Max 10/year (no carry forward). First 1 request/month auto-approved (max 1 day). 2nd+ or >1 day → manager.
- Business: Max 20/year. Always manager approval.
- Family: Max 10/year. Always manager approval.
- Unpaid: Apply when all leave types exhausted. Always manager approval.
- Tagged employees → all leaves require manager approval (no auto-approval)
- 70-day cancellation window for approved leaves

Use the get_leave_policy tool for detailed policy data. Be friendly and informative."""

ANALYTICS_PROMPT = """You are the Analytics Agent — an AI assistant that answers questions about leave balance, manager info, HR contact, project tagging, and profile details.
When asked about balance use get_leave_balance. For manager info use get_manager_info. For HR contact use get_hr_contact. For employee details use get_employee_by_id.
Present data clearly and concisely."""

APPROVAL_PROMPT = """You are the Approval Agent — an AI assistant for managers handling leave approvals. You help managers:
1. View pending leave requests using get_pending_requests
2. Approve leaves using approve_leave (confirm with manager first)
3. Reject leaves using reject_leave (always ask for a reason first)
4. View cancellation requests using get_cancellation_requests
5. Approve/reject cancellations

Present pending requests clearly. Always confirm before approving or rejecting."""

TEAM_PROMPT = """You are the Team Agent — an AI assistant for manager team management. You help managers:
1. Get team member details using get_employee_leave_detail (by EMP ID)
2. View who is on leave today using check_team_availability
3. List all team members
4. Get leave stats using get_team_leave_stats

Present information clearly with employee names, IDs, leave dates, and status."""

MGR_ANALYTICS_PROMPT = """You are the Analytics Agent — an AI assistant for manager analytics. You help managers:
1. Get team leave statistics for today, week, month, or all time using get_team_leave_stats
2. Answer questions like "How many approved/rejected?"
3. Get detailed employee leave info using get_employee_leave_detail

Present data in a clear, organized format."""

HR_EMP_PROMPT = """You are the Employee Management Agent — an AI assistant for HR managing employee profiles. You help HR:
1. View all employees using get_all_employees
2. Get employee details by ID using get_employee_by_id (shows ID, name, email, phone, DOJ, designation, project tag, document, balance, etc.)
3. View leave history for an employee using get_leave_history
4. Check a specific leave request status using get_leave_by_id
5. View leave balance for an employee using get_leave_balance
6. Answer questions like "how many employees?" (use get_all_employees), "how many sick leaves for employee X?" (use get_leave_history and count manually)

You CANNOT create employees through the chat — HR must use the Create Employee form in the UI.
Be professional and concise. When asked for counts, use tools and provide the numbers clearly."""

HR_DATA_PROMPT = """You are the Data Agent — an AI assistant for HR analytics. You help HR:
1. View organization-wide leave statistics using get_all_employees (get all employees) and count/filter manually
2. Get details on specific employees using get_employee_by_id (shows all fields including ID, name, email, phone, designation, DOJ, project tag, etc.)
3. View leave policy information using get_leave_policy
4. Check leave requests by ID using get_leave_by_id
5. View leave history using get_leave_history
6. View leave balance using get_leave_balance

Present data in a clear, organized format with counts and breakdowns."""


# ---- Agent Definitions ----
EMPLOYEE_AGENTS = [
    {"name": "Leave Manager Agent", "prompt": LEAVE_PROMPT, "description": "Handles applying, cancelling, and checking leave status"},
    {"name": "Policy Agent", "prompt": POLICY_PROMPT, "description": "Answers policy, rules, and eligibility questions"},
    {"name": "Analytics Agent", "prompt": ANALYTICS_PROMPT, "description": "Answers balance, manager, HR, and profile questions"},
]

MANAGER_AGENTS = [
    {"name": "Approval Agent", "prompt": APPROVAL_PROMPT, "description": "Handles leave approvals, rejections, and cancellations"},
    {"name": "Team Agent", "prompt": TEAM_PROMPT, "description": "Team member details, on-leave status, and profiles"},
    {"name": "Analytics Agent", "prompt": MGR_ANALYTICS_PROMPT, "description": "Team leave stats, trends, and reports"},
]

HR_AGENTS = [
    {"name": "Employee Agent", "prompt": HR_EMP_PROMPT, "description": "View employee profiles and details"},
    {"name": "Data Agent", "prompt": HR_DATA_PROMPT, "description": "Organization-wide leave data and statistics"},
]


def make_supervisor_node(agents):
    async def supervisor_node(state: AgentState, config) -> dict:
        last_msg = state["messages"][-1]
        text = last_msg.get("content", "")
        if isinstance(text, list):
            text = text[0].get("text", "") if text else ""
        agent_name = classify_intent(text, state["user"], agents)
        return {"next": agent_name}
    return supervisor_node


def route_from_supervisor(state: AgentState) -> str:
    return state["next"]


def make_agent_node(agent_def):
    async def agent_node(state: AgentState, config) -> dict:
        last_msg = state["messages"][-1]
        text = last_msg.get("content", "")
        if isinstance(text, list):
            text = text[0].get("text", "") if text else ""
        response = call_agent_with_tools(agent_def["prompt"], text, state["user"])
        return {"agent_response": response, "active_agent": agent_def["name"]}
    return agent_node


def build_employee_graph() -> StateGraph:
    workflow = StateGraph(AgentState)
    workflow.add_node("supervisor", make_supervisor_node(EMPLOYEE_AGENTS))
    for a in EMPLOYEE_AGENTS:
        workflow.add_node(a["name"], make_agent_node(a))

    workflow.add_edge(START, "supervisor")
    routing_map = {a["name"]: a["name"] for a in EMPLOYEE_AGENTS}
    workflow.add_conditional_edges("supervisor", route_from_supervisor, routing_map)
    for a in EMPLOYEE_AGENTS:
        workflow.add_edge(a["name"], END)

    return workflow.compile()


def build_manager_graph() -> StateGraph:
    workflow = StateGraph(AgentState)
    workflow.add_node("supervisor", make_supervisor_node(MANAGER_AGENTS))
    for a in MANAGER_AGENTS:
        workflow.add_node(a["name"], make_agent_node(a))

    workflow.add_edge(START, "supervisor")
    routing_map = {a["name"]: a["name"] for a in MANAGER_AGENTS}
    workflow.add_conditional_edges("supervisor", route_from_supervisor, routing_map)
    for a in MANAGER_AGENTS:
        workflow.add_edge(a["name"], END)

    return workflow.compile()


def build_hr_graph() -> StateGraph:
    workflow = StateGraph(AgentState)
    workflow.add_node("supervisor", make_supervisor_node(HR_AGENTS))
    for a in HR_AGENTS:
        workflow.add_node(a["name"], make_agent_node(a))

    workflow.add_edge(START, "supervisor")
    routing_map = {a["name"]: a["name"] for a in HR_AGENTS}
    workflow.add_conditional_edges("supervisor", route_from_supervisor, routing_map)
    for a in HR_AGENTS:
        workflow.add_edge(a["name"], END)

    return workflow.compile()
