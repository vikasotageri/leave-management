const API_BASE = "/api";

function getToken() {
  return localStorage.getItem("token");
}

async function request(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    ...options.headers,
  };
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || `API error: ${res.status}`);
  return data;
}

export const api = {
  login: async (email, password) => {
    const data = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem("token", data.token);
    localStorage.setItem("currentUser", JSON.stringify(data.user));
    return { success: true, user: data.user };
  },

  getMe: async () => {
    return request("/auth/me");
  },

  getEmployees: async () => {
    return request("/employees");
  },

  getAllEmployees: async () => {
    return request("/employees/all");
  },

  getEmployee: async (id) => {
    return request(`/employees/${id}`);
  },

  createEmployee: async (data) => {
    return request("/employees", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  deleteEmployee: async (id) => {
    return request(`/employees/${id}`, { method: "DELETE" });
  },

  getLeaveBalance: async (employeeId) => {
    return request(`/employees/${employeeId}/balance`);
  },

  getLeaveHistory: async (employeeId, limit = 10) => {
    return request(`/employees/${employeeId}/leaves?limit=${limit}`);
  },

  getUpcomingLeaves: async (employeeId) => {
    return request(`/employees/${employeeId}/upcoming`);
  },

  applyLeave: async (data) => {
    return request("/leaves", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  cancelLeave: async (leaveId, reason) => {
    return request("/leaves/cancel", {
      method: "POST",
      body: JSON.stringify({ leave_id: leaveId, reason }),
    });
  },

  approveLeave: async (leaveId) => {
    return request("/leaves/approve", {
      method: "POST",
      body: JSON.stringify({ leave_id: leaveId }),
    });
  },

  rejectLeave: async (leaveId, reason) => {
    return request("/leaves/reject", {
      method: "POST",
      body: JSON.stringify({ leave_id: leaveId, reason }),
    });
  },

  approveCancellation: async (leaveId) => {
    return request("/leaves/approve-cancellation", {
      method: "POST",
      body: JSON.stringify({ leave_id: leaveId }),
    });
  },

  rejectCancellation: async (leaveId) => {
    return request("/leaves/reject-cancellation", {
      method: "POST",
      body: JSON.stringify({ leave_id: leaveId }),
    });
  },

  getPendingRequests: async (managerId) => {
    return request(`/leaves/pending/${managerId}`);
  },

  getCancellationRequests: async (managerId) => {
    return request(`/leaves/cancellations/${managerId}`);
  },

  getTeamLeaves: async (managerId) => {
    return request(`/leaves/team/${managerId}`);
  },

  getTeamLeaveRequests: async (managerId) => {
    return request(`/leaves/employee/${managerId}`);
  },

  getNotifications: async (userId) => {
    return request(`/notifications/${userId}`);
  },

  createNotification: async (data) => {
    return request("/notifications", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  markNotificationRead: async (id) => {
    return request(`/notifications/${id}/read`, { method: "PUT" });
  },

  sendChat: async (message, user) => {
    return request("/chat", {
      method: "POST",
      body: JSON.stringify({
        message,
        user_id: user.id,
        user_name: user.name,
        user_role: user.role,
      }),
    });
  },

  getTeamLeaveStats: async (managerId, period = "all") => {
    return request("/leaves/stats", {
      method: "POST",
      body: JSON.stringify({ manager_id: managerId, period }),
    });
  },

  checkTeamAvailability: async (managerId, date) => {
    return request("/leaves/availability", {
      method: "POST",
      body: JSON.stringify({ manager_id: managerId, date }),
    });
  },

  setProjectTag: async (employeeId, projectName) => {
    return request("/employees", {
      method: "POST",
      body: JSON.stringify({ employee_id: employeeId, project_tag: projectName }),
    });
  },
};
