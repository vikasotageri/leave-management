export const toolSchemas = [
  {
    name: "get_leave_balance",
    description: "Get the current employee's leave balance for all leave types",
    parameters: {
      type: "object",
      properties: {
        employeeId: { type: "string", description: "The employee ID" },
      },
      required: ["employeeId"],
    },
  },
  {
    name: "get_leave_history",
    description: "Get the last 10 leave records for an employee",
    parameters: {
      type: "object",
      properties: {
        employeeId: { type: "string", description: "The employee ID" },
      },
      required: ["employeeId"],
    },
  },
  {
    name: "get_upcoming_leaves",
    description: "Get upcoming leaves (future dates) for an employee",
    parameters: {
      type: "object",
      properties: {
        employeeId: { type: "string", description: "The employee ID" },
      },
      required: ["employeeId"],
    },
  },
  {
    name: "apply_leave",
    description: "Apply for a leave on behalf of the employee",
    parameters: {
      type: "object",
      properties: {
        employeeId: { type: "string", description: "The employee ID" },
        type: { type: "string", enum: ["sick", "casual", "emergency"], description: "Type of leave" },
        startDate: { type: "string", description: "Start date in YYYY-MM-DD format" },
        endDate: { type: "string", description: "End date in YYYY-MM-DD format" },
        reason: { type: "string", description: "Reason for the leave" },
      },
      required: ["employeeId", "type", "startDate", "endDate", "reason"],
    },
  },
  {
    name: "cancel_leave",
    description: "Request cancellation of an existing leave",
    parameters: {
      type: "object",
      properties: {
        leaveId: { type: "string", description: "The leave ID to cancel" },
        reason: { type: "string", description: "Reason for cancellation" },
      },
      required: ["leaveId", "reason"],
    },
  },
  {
    name: "get_pending_requests",
    description: "Get all pending leave requests for the manager's team",
    parameters: {
      type: "object",
      properties: {
        managerId: { type: "string", description: "The manager ID" },
      },
      required: ["managerId"],
    },
  },
  {
    name: "approve_leave",
    description: "Approve a pending leave request",
    parameters: {
      type: "object",
      properties: {
        leaveId: { type: "string", description: "The leave ID to approve" },
      },
      required: ["leaveId"],
    },
  },
  {
    name: "reject_leave",
    description: "Reject a pending leave request with a reason",
    parameters: {
      type: "object",
      properties: {
        leaveId: { type: "string", description: "The leave ID to reject" },
        reason: { type: "string", description: "Reason for rejection" },
      },
      required: ["leaveId", "reason"],
    },
  },
  {
    name: "get_cancellation_requests",
    description: "Get all pending cancellation requests for the manager's team",
    parameters: {
      type: "object",
      properties: {
        managerId: { type: "string", description: "The manager ID" },
      },
      required: ["managerId"],
    },
  },
  {
    name: "approve_cancellation",
    description: "Approve a cancellation request (days will be returned to employee balance)",
    parameters: {
      type: "object",
      properties: {
        leaveId: { type: "string", description: "The leave ID to cancel" },
      },
      required: ["leaveId"],
    },
  },
  {
    name: "check_team_availability",
    description: "Check how many team members are available on a given date",
    parameters: {
      type: "object",
      properties: {
        managerId: { type: "string", description: "The manager ID" },
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
      },
      required: ["managerId", "date"],
    },
  },
  {
    name: "get_leave_policy",
    description: "Get the company leave policy information",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_team_leave_stats",
    description: "Get leave statistics for the manager's team - total, approved, rejected, pending counts and list",
    parameters: {
      type: "object",
      properties: {
        managerId: { type: "string", description: "The manager ID" },
        period: { type: "string", enum: ["today", "week", "month", "all"], description: "Time period for stats" },
      },
      required: ["managerId"],
    },
  },
  {
    name: "get_employee_leave_detail",
    description: "Get detailed leave information for a specific employee by their ID",
    parameters: {
      type: "object",
      properties: {
        employeeId: { type: "string", description: "The employee ID (e.g. EMP001)" },
      },
      required: ["employeeId"],
    },
  },
  {
    name: "get_hr_contact",
    description: "Get HR department contact information",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_manager_info",
    description: "Get the current employee's manager information",
    parameters: {
      type: "object",
      properties: {
        employeeId: { type: "string", description: "The employee ID" },
      },
      required: ["employeeId"],
    },
  },
  {
    name: "get_all_employees",
    description: "Get a list of all employees (for HR)",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_employee_by_id",
    description: "Get detailed employee information by their ID",
    parameters: {
      type: "object",
      properties: {
        employeeId: { type: "string", description: "The employee ID (e.g. EMP001)" },
      },
      required: ["employeeId"],
    },
  },
];
