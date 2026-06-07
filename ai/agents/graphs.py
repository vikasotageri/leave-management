"""
================================================================================
 LEAVE FLOW — LangGraph StateGraph Definitions (Role-Based Graphs)
================================================================================

 PURPOSE:
  Defines three separate LangGraph StateGraph workflows — one per user role.
  Each graph has a supervisor node that classifies intent, routes to the
  correct specialist agent, and returns a response.

 CALLED BY:
  - backend/routers/chat.py (lines 8-10): build_employee_graph(), build_manager_graph(),
    build_hr_graph() called once at module load time

 WHERE IT FITS (AI FLOW):
  POST /api/chat → chat.py → selects graph by role
    → graph.invoke({"messages": [...], "user": {...}})
      → supervisor_node (classify_intent)
        → conditional edge to specialist agent node
          → call_agent_with_tools (LLM + tool bindings)
            → returns agent_response
    → Returns {"response": result}

 ROLE-BASED GRAPHS:
  - Employee Graph: 3 agents (Leave Manager, Policy, Analytics)
  - Manager Graph:  3 agents (Approval, Team, Analytics)
  - HR Graph:       2 agents (Employee, Data)

 DESIGN:
  - Each agent has a system prompt describing its role and available tools
  - Supervisor uses LLM-based classify_intent() — NO regex routing
  - Agent nodes call call_agent_with_tools() which binds 19+ tool schemas
    for GPT-4o-mini function calling
================================================================================
"""

from typing import TypedDict, Optional
from langgraph.graph import StateGraph, END, START
from ai.agents.supervisor import classify_intent, call_agent_with_tools


class AgentState(TypedDict):
    """
    State type for the LangGraph StateGraph.

    Attributes:
        messages:      Chat message history (list of dicts with role/content)
        user:          User info dict {id, name, role}
        agent_response: Response string from the specialist agent
        next:          Next agent name (set by supervisor routing)
        active_agent:  Name of the currently active specialist agent
    """
    messages: list
    user: dict
    agent_response: Optional[str]
    next: Optional[str]
    active_agent: Optional[str]


# ======================================================================
# SYSTEM PROMPTS (one per specialist agent per role)
# ======================================================================

LEAVE_PROMPT = """You are the Leave Manager Agent.
Help employees only with their own leave actions. ALWAYS USE TOOLS to look up data. Never guess. Never use information from conversation context to answer about leave — always call a tool first.

APPLY LEAVE steps (execute in order):
1. Ask user for leave type (casual/sick/business/emergency/family/unpaid).
2. Ask user for reason.
3. If the reason clearly matches a DIFFERENT leave type (e.g., reason 'sick' or 'medical' for casual), ask user: 'The reason sounds like {type}. Did you want {type} leave instead?'
4. Call apply_leave with all fields.

CANCEL LEAVE steps:
1. Call cancel_leave(date=YYYY-MM-DD) with the EXACT date the user gives. The tool finds the leave by date automatically.
2. If not found -> tell user no leave on that date.
3. If found and APPROVED: ask user for reason, then call cancel_leave(date, reason) again.
4. If found and PENDING: call cancel_leave(date) — auto deleted.
5. If found and CANCELLATION_REQUESTED: call cancel_leave(date) — reverts to approved.

Rules:
- Never invent leave records. Match dates EXACTLY.
- Never reveal other employees' personal data.
- Pending leaves CAN be cancelled. Approved leaves CAN be cancelled (with reason).
- OUTPUT: plain text only, 1-3 lines. NO markdown, NO bullets, NO bold, NO emoji."""

POLICY_PROMPT = """You are the Policy Agent.
Explain company leave policy clearly and briefly in plain text.
No markdown, no bullets, no emoji. 1-3 lines only.

Key policy facts:
- Casual: Max 24/year, 2/month from DOJ (carried forward). First 2 requests/month auto-approved (max 2 days at a time). 3rd+ or >2 days → manager.
- Sick: Max 12/year (no carry forward). First 1 request/month auto-approved (max 1 day). 2nd+ or >1 day → manager.
- Emergency: Max 10/year (no carry forward). First 1 request/month auto-approved (max 1 day). 2nd+ or >1 day → manager.
- Business: Max 20/year. Always manager approval.
- Family: Max 10/year. Always manager approval.
- Unpaid: Apply when all leave types exhausted. Always manager approval.
- Tagged employees → all leaves require manager approval (no auto-approval)
- 70-day cancellation window for approved leaves

Use get_leave_policy tool only if needed."""

ANALYTICS_PROMPT = """You are the Analytics Agent.
Answer only with short, exact employee leave and profile facts.
Rules:
- You CAN show the logged-in employee's own personal details (name, ID, email, phone, gender, DOB, DOJ, etc.).
- Never reveal OTHER employees' personal data.
- If user asks 'am I tagged' or 'do I have a project tag' or 'what is my project' -> use get_my_profile tool (it shows the project tag).
- If user asks to BE tagged or CHANGE their tag -> say 'Only HR or Manager can change project tags.'
- When asked about HR contact info -> use get_hr_contact tool.
- When asked about manager info -> use get_manager_info tool with the employee's ID.
- When asked about personal/profile details, use get_my_profile tool which returns all fields.
- OUTPUT: plain text only, 1-3 lines. NO markdown, NO bullets, NO bold, NO emoji.
Use get_leave_balance, get_employee_leave_summary, get_my_profile, get_hr_contact, or get_manager_info tools."""

GENERAL_PROMPT = """You are a helpful General Assistant.
Answer any question briefly and directly in 1-3 lines. You can answer general knowledge, coding, non-work questions.
For company-specific questions (HR contact, manager info, employee count), USE tools (get_hr_contact, get_manager_info, get_employee_by_id) instead of guessing.
OUTPUT: plain text only. 1-3 lines. NEVER use markdown formatting. NO code fences (```). NO bullets. NO bold. NO emoji. For code: write code inline separated by semicolons or describe it."""

APPROVAL_PROMPT = """You are the Approval Agent.
Help managers with leave approvals only. ALWAYS USE TOOLS.
1. View pending leave requests using get_pending_requests (call it fresh each time)
2. Approve leaves:
   - If manager says 'approve leave for EMP001 on 26-05-2026': use approve_leave_by_employee(employee_id, date)
   - If manager says 'approve leave L-xxxxxx': use approve_leave(leave_id)
3. Reject leaves:
   - If manager says 'reject EMP001 on 26-05-2026 with reason': use reject_leave_by_employee(employee_id, date, reason)
   - ALWAYS ask for a reason before rejecting, unless user already gave one
4. View cancellation requests using get_cancellation_requests
5. Approve cancellations with approve_cancellation, reject with reject_cancellation
6. For employee-specific info use get_employee_by_id or get_employee_leave_detail
7. To count pending/cancellation by employee: call get_pending_requests or get_cancellation_requests then count manually

IMPORTANT: Always call tools to get up-to-date data. Never guess leave_ids, employee names, or counts from conversation context.

OUTPUT: plain text only. NO markdown, NO bullets, NO emoji. Brief and direct."""

TEAM_PROMPT = """You are the Team Agent.
Help managers with team-only information. ALWAYS USE TOOLS.
1. List team members using get_team_members(manager_id) — returns all members with id, name, designation, gender, doj, project_tag, role, email, phone
2. Filter team members by designation/role using get_team_members then manually check results
3. Filter by project_tag using get_team_members — check the project_tag field (e.g., "SAP")
4. Filter by gender using get_team_members — check the gender field ("Male"/"Female")
5. Get team leave stats using get_team_leave_stats
6. View who is on leave on a date using check_team_availability
7. For employee-specific details use get_employee_by_id or get_employee_leave_detail
8. You can ALSO call get_all_employees and filter programmatically for org-wide queries

IMPORTANT: Always call get_team_members or get_employee_by_id to verify names and IDs match. Never guess from conversation context.

OUTPUT: plain text only. No markdown, no bullets, no emoji. Keep replies short and factual."""

MGR_ANALYTICS_PROMPT = """You are the Analytics Agent.
Help managers with team queries. ALWAYS USE TOOLS.
1. Get team members list using get_team_members(manager_id) — shows id, name, designation, gender, doj, project_tag for each member
2. Filter by project_tag: call get_team_members, then check the 'project_tag' field. Show name + id + tag.
   Example: "who are tagged to SAP" → call get_team_members, filter where project_tag == "SAP", reply with names and IDs
3. Filter by designation/role: call get_team_members, then check 'designation' field.
   Example: "who are data scientists" → call get_team_members, filter where designation matches, reply with names and IDs
4. Filter by gender: call get_team_members, then check 'gender' field.
   Example: "how many female employees" → call get_team_members, count where gender == "Female"
5. Show ALL designations: call get_team_members, collect unique designation values
6. Show ALL project tags: call get_team_members, collect unique project_tag values
7. Count team members: call get_team_members return len(results)
8. Show past pending leaves: call get_pending_requests, compare each leave's start_date against today's date. Leaves with start_date before today are PAST pending (overdue, not yet approved). Leaves with start_date today or later are UPCOMING pending (future leaves yet to approve).
9. Get team leave stats using get_team_leave_stats
10. Get employee detail using get_employee_by_id or get_employee_leave_detail

IMPORTANT: Always call tools to look up data. Never guess names, IDs, or counts from conversation context.

OUTPUT: plain text only. No markdown, no bullets, no emoji. Keep replies short and factual."""

HR_EMP_PROMPT = """You are the Employee Management Agent.
Help HR manage employee profiles briefly:
1. View all employees using get_all_employees
2. Get employee details by ID using get_employee_by_id (shows ID, name, email, phone, DOJ, designation, project tag, document, balance, etc.)
3. View leave history for an employee using get_leave_history
4. Check a specific leave request status using get_leave_by_id
5. View leave balance for an employee using get_leave_balance

HR cannot create employees through chat. Use the form in the UI.
OUTPUT: plain text. No markdown, no bullets, no emoji."""

HR_DATA_PROMPT = """You are the Data Agent.
Help HR with company leave data briefly:
1. View organization-wide leave statistics using get_all_employees and filter manually
2. Get details on specific employees using get_employee_by_id
3. View leave policy information using get_leave_policy
4. Check leave requests by ID using get_leave_by_id
5. View leave history using get_leave_history
6. View leave balance using get_leave_balance

OUTPUT: plain text. No markdown, no bullets, no emoji."""


# ======================================================================
# AGENT DEFINITIONS (organized by role)
# ======================================================================

EMPLOYEE_AGENTS = [
    {"name": "Leave Manager Agent", "prompt": LEAVE_PROMPT, "description": "Handles applying, cancelling, and checking leave status or summary"},
    {"name": "Policy Agent", "prompt": POLICY_PROMPT, "description": "Answers policy, rules, and eligibility questions"},
    {"name": "Analytics Agent", "prompt": ANALYTICS_PROMPT, "description": "Answers balance, project tag, leave summary, profile, HR/manager contact, and personal details questions"},
    {"name": "General Assistant", "prompt": GENERAL_PROMPT, "description": "Answers general knowledge, coding, and non-leave questions"},
]

MANAGER_AGENTS = [
    {"name": "Approval Agent", "prompt": APPROVAL_PROMPT, "description": "Handles leave approvals, rejections, and cancellations"},
    {"name": "Team Agent", "prompt": TEAM_PROMPT, "description": "Team member details, on-leave status, designations, roles, project tags, and profiles"},
    {"name": "Analytics Agent", "prompt": MGR_ANALYTICS_PROMPT, "description": "Team leave stats, trends, reports, counts, past/upcoming pending leaves, and profile details"},
]

HR_AGENTS = [
    {"name": "Employee Agent", "prompt": HR_EMP_PROMPT, "description": "View employee profiles and details"},
    {"name": "Data Agent", "prompt": HR_DATA_PROMPT, "description": "Organization-wide leave data and statistics"},
    {"name": "General Assistant", "prompt": GENERAL_PROMPT, "description": "Answers general knowledge, coding, and non-leave questions"},
]


# ======================================================================
# GRAPH CONSTRUCTION FUNCTIONS
# ======================================================================

def make_supervisor_node(agents):
    """
    Factory: Creates a supervisor node for a given agent list.

    The supervisor calls classify_intent() with the user's message and
    available agents, then returns the name of the agent that should handle it.
    """
    async def supervisor_node(state: AgentState, config) -> dict:
        last_msg = state["messages"][-1]
        text = last_msg.get("content", "")
        if isinstance(text, list):
            text = text[0].get("text", "") if text else ""
        agent_name = classify_intent(text, state["user"], agents)
        return {"next": agent_name}
    return supervisor_node


def route_from_supervisor(state: AgentState) -> str:
    """
    Conditional edge function: routes to the agent named in state["next"].
    Used by add_conditional_edges() in each graph builder.
    """
    return state["next"]


def make_agent_node(agent_def):
    """
    Factory: Creates a specialist agent node for a given agent definition.

    The agent node calls call_agent_with_tools() with the agent's system prompt
    and the user message. Returns the LLM response (which may include tool calls).
    """
    async def agent_node(state: AgentState, config) -> dict:
        last_msg = state["messages"][-1]
        text = last_msg.get("content", "")
        if isinstance(text, list):
            text = text[0].get("text", "") if text else ""
        response = call_agent_with_tools(agent_def["prompt"], text, state["user"])
        return {"agent_response": response, "active_agent": agent_def["name"]}
    return agent_node


def build_employee_graph() -> StateGraph:
    """
    Build the LangGraph StateGraph for employee role.
    Graph: START → supervisor → (conditional) → [Leave Manager | Policy | Analytics] → END
    """
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
    """
    Build the LangGraph StateGraph for manager role.
    Graph: START → supervisor → (conditional) → [Approval | Team | Analytics] → END
    """
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
    """
    Build the LangGraph StateGraph for HR role.
    Graph: START → supervisor → (conditional) → [Employee Agent | Data Agent] → END
    """
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
