import { getEmployees, saveEmployees, getEmployeeById, getEmployeeByEmail } from "../data/employees";
import { getLeaveRecords, saveLeaveRecords, generateId } from "../data/leaveRecords";
import { getLeavePolicy } from "../data/leavePolicies";
import { addNotification, getNotifications, saveNotifications } from "../data/notifications";

const sendNotification = (to, subject, message, type = "email") => {
  const managerUser = getEmployees().find((e) => e.role === "manager");
  const recipientEmail = to === "manager" ? (managerUser?.email || "manager@company.com") : to;
  addNotification({
    type,
    to: to === "manager" ? "Manager" : to,
    subject,
    message,
    email: recipientEmail,
  });
};

const isWithinMonths = (dateStr, months) => {
  const date = new Date(dateStr);
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + months);
  return date <= maxDate;
};

const getRemainingThisMonth = (employee, type) => {
  const records = getLeaveRecords();
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const taken = records.filter(
    (r) =>
      r.employeeId === employee.id &&
      r.type === type &&
      (r.status === "approved" || r.status === "auto-approved") &&
      new Date(r.startDate).getMonth() === month &&
      new Date(r.startDate).getFullYear() === year
  );
  const daysUsed = taken.reduce((sum, r) => {
    const start = new Date(r.startDate);
    const end = new Date(r.endDate);
    return sum + Math.floor((end - start) / 86400000) + 1;
  }, 0);
  return daysUsed;
};

const getRemainingThisYear = (employee, type) => {
  const records = getLeaveRecords();
  const year = new Date().getFullYear();
  const taken = records.filter(
    (r) =>
      r.employeeId === employee.id &&
      r.type === type &&
      (r.status === "approved" || r.status === "auto-approved") &&
      new Date(r.startDate).getFullYear() === year
  );
  return taken.reduce((sum, r) => {
    const start = new Date(r.startDate);
    const end = new Date(r.endDate);
    return sum + Math.floor((end - start) / 86400000) + 1;
  }, 0);
};

const getSickCasualCombined = (employee) => {
  const records = getLeaveRecords();
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const taken = records.filter(
    (r) =>
      r.employeeId === employee.id &&
      (r.type === "sick" || r.type === "casual") &&
      (r.status === "approved" || r.status === "auto-approved" || r.status === "pending") &&
      new Date(r.startDate).getMonth() === month &&
      new Date(r.startDate).getFullYear() === year
  );
  return taken.reduce((sum, r) => {
    const start = new Date(r.startDate);
    const end = new Date(r.endDate);
    return sum + Math.floor((end - start) / 86400000) + 1;
  }, 0);
};

const checkTeamConflict = (employeeId, startDate, endDate) => {
  const records = getLeaveRecords();
  const employees = getEmployees();
  const employee = employees.find((e) => e.id === employeeId);
  if (!employee || !employee.managerId) return false;
  const teamMembers = employees.filter((e) => e.managerId === employee.managerId && e.id !== employeeId);
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (const member of teamMembers) {
    const memberLeaves = records.filter(
      (r) =>
        r.employeeId === member.id &&
        (r.status === "approved" || r.status === "auto-approved")
    );
    for (const leave of memberLeaves) {
      const lStart = new Date(leave.startDate);
      const lEnd = new Date(leave.endDate);
      if (start <= lEnd && end >= lStart) return true;
    }
  }
  return false;
};

export const mockApi = {
  login: (email, password) => {
    const employees = getEmployees();
    const user = employees.find((e) => e.email === email && e.password === password);
    if (!user) return { success: false, error: "Invalid email or password" };
    return { success: true, user: { ...user, password: undefined } };
  },

  getEmployeeLeaveBalance: (employeeId) => {
    const employee = getEmployeeById(employeeId);
    if (!employee) return null;
    const policy = getLeavePolicy();
    return {
      sick: {
        remaining: employee.leaveBalance.sick.limit - getRemainingThisMonth(employee, "sick"),
        limit: employee.leaveBalance.sick.limit,
      },
      casual: {
        remaining: employee.leaveBalance.casual.limit - getRemainingThisMonth(employee, "casual"),
        limit: employee.leaveBalance.casual.limit,
      },
      business: {
        remaining: (employee.leaveBalance.business?.limit ?? 0) - getRemainingThisMonth(employee, "business"),
        limit: employee.leaveBalance.business?.limit ?? 0,
      },
      emergency: {
        remaining: Math.min(
          employee.leaveBalance.emergency.limit - getRemainingThisMonth(employee, "emergency"),
          policy.leaveTypes.emergency.yearlyLimit - getRemainingThisYear(employee, "emergency")
        ),
        monthlyLimit: employee.leaveBalance.emergency.limit,
        yearlyLimit: policy.leaveTypes.emergency.yearlyLimit,
        usedThisYear: getRemainingThisYear(employee, "emergency"),
      },
      total: {
        accrued: employee.leaveBalance.totalAccrued,
        taken: employee.leaveBalance.totalTaken,
        remaining: employee.leaveBalance.totalAccrued - employee.leaveBalance.totalTaken,
      },
    };
  },

  getEmployeeLeaves: (employeeId, limit = 10) => {
    const records = getLeaveRecords();
    return records
      .filter((r) => r.employeeId === employeeId)
      .sort((a, b) => new Date(b.appliedOn) - new Date(a.appliedOn))
      .slice(0, limit);
  },

  getUpcomingLeaves: (employeeId) => {
    const records = getLeaveRecords();
    const today = new Date();
    return records
      .filter(
        (r) =>
          r.employeeId === employeeId &&
          new Date(r.startDate) >= today &&
          (r.status === "approved" || r.status === "auto-approved" || r.status === "pending")
      )
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  },

  applyLeave: (employeeId, type, startDate, endDate, reason, document) => {
    const employee = getEmployeeById(employeeId);
    if (!employee) return { success: false, error: "Employee not found" };

    if (!isWithinMonths(startDate, 2)) {
      return { success: false, error: "Cannot apply leave more than 2 months in advance" };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.floor((end - start) / 86400000) + 1;

    let status = "pending";
    let approvedBy = null;
    const policy = getLeavePolicy();

    const isProjectTagged = employee.projectTag !== null;

    if (!isProjectTagged) {
      const sickTaken = getRemainingThisMonth(employee, "sick");
      const casualTaken = getRemainingThisMonth(employee, "casual");
      const emergencyTaken = getRemainingThisMonth(employee, "emergency");
      const emergencyYearTaken = getRemainingThisYear(employee, "emergency");
      const combinedTaken = getSickCasualCombined(employee);

      let canAutoApprove = true;

      if (type === "sick" && sickTaken + days > policy.leaveTypes.sick.monthlyLimit) canAutoApprove = false;
      if (type === "casual" && casualTaken + days > policy.leaveTypes.casual.monthlyLimit) canAutoApprove = false;
      if (type === "emergency" && emergencyTaken + days > policy.leaveTypes.emergency.monthlyLimit) canAutoApprove = false;
      if (type === "emergency" && emergencyYearTaken + days > policy.leaveTypes.emergency.yearlyLimit) canAutoApprove = false;
      if (type === "sick" && combinedTaken + days > policy.autoApprovalRules.sickCasualCombinedMax) canAutoApprove = false;
      if (type === "casual" && combinedTaken + days > policy.autoApprovalRules.sickCasualCombinedMax) canAutoApprove = false;
      if (checkTeamConflict(employeeId, startDate, endDate)) canAutoApprove = false;

      if (canAutoApprove) {
        status = "auto-approved";
        approvedBy = "system";
      }
    }

    const newLeave = {
      id: generateId(),
      employeeId,
      employeeName: employee.name,
      type,
      startDate,
      endDate,
      reason,
      document: document || null,
      status,
      appliedOn: new Date().toISOString().replace("T", " ").slice(0, 19),
      approvedBy,
      notifiedManager: false,
    };

    const records = getLeaveRecords();
    records.push(newLeave);
    saveLeaveRecords(records);

    if (status === "auto-approved") {
      const emps = getEmployees();
      const empIdx = emps.findIndex((e) => e.id === employeeId);
      if (empIdx !== -1) {
        emps[empIdx].leaveBalance.totalTaken += days;
        if (type === "sick") emps[empIdx].leaveBalance.sick.taken += days;
        if (type === "casual") emps[empIdx].leaveBalance.casual.taken += days;
        if (type === "business") emps[empIdx].leaveBalance.business.taken += days;
        if (type === "emergency") emps[empIdx].leaveBalance.emergency.taken += days;
        saveEmployees(emps);
      }
    }

    if (status === "auto-approved") {
      sendNotification(
        "manager",
        `[Auto-Approval] ${employee.name} - ${type.charAt(0).toUpperCase() + type.slice(1)} Leave`,
        `${employee.name} applied for ${type} leave (${startDate} to ${endDate}). Reason: ${reason}. Auto-approved per policy.`
      );
      sendNotification(
        employee.email,
        `[Approved] Your ${type.charAt(0).toUpperCase() + type.slice(1)} Leave is Auto-Approved`,
        `Your ${type} leave from ${startDate} to ${endDate} has been auto-approved per company policy.`
      );
    } else {
      sendNotification(
        "manager",
        `[Pending] ${employee.name} - ${type.charAt(0).toUpperCase() + type.slice(1)} Leave`,
        `${employee.name} applied for ${type} leave (${startDate} to ${endDate}). Reason: ${reason}. Needs your review.`
      );
    }

    return { success: true, leave: newLeave, status };
  },

  cancelLeaveRequest: (leaveId, reason) => {
    const records = getLeaveRecords();
    const leave = records.find((r) => r.id === leaveId);
    if (!leave) return { success: false, error: "Leave not found" };

    const leaveDate = new Date(leave.startDate);
    const daysDiff = Math.floor((new Date() - leaveDate) / 86400000);
    if (daysDiff > 70) {
      return { success: false, error: "Cannot cancel leave older than 70 days" };
    }

    const employee = getEmployeeById(leave.employeeId);
    if (!employee) return { success: false, error: "Employee not found" };

    const idx = records.findIndex((r) => r.id === leaveId);

    if (leave.status === "pending") {
      records[idx].status = "auto-cancelled";
      records[idx].cancellationReason = reason || "Auto-cancelled by employee";
      saveLeaveRecords(records);
      sendNotification(
        "manager",
        `[Cancelled] ${employee.name} cancelled pending ${leave.type} leave`,
        `${employee.name} cancelled their pending ${leave.type} leave (${leave.startDate}).`
      );
      return { success: true, leave: records[idx], autoCancelled: true };
    }

    records[idx].status = "cancellation-pending";
    records[idx].cancellationReason = reason;
    saveLeaveRecords(records);

    sendNotification(
      "manager",
      `[Cancellation Request] ${employee.name} wants to cancel approved ${leave.type} leave`,
      `${employee.name} requested cancellation of approved ${leave.type} leave (${leave.startDate}). Reason: ${reason}. Please approve or reject.`
    );

    return { success: true, leave: records[idx] };
  },

  approveLeave: (leaveId) => {
    const records = getLeaveRecords();
    const idx = records.findIndex((r) => r.id === leaveId);
    if (idx === -1) return { success: false, error: "Leave not found" };

    records[idx].status = "approved";
    records[idx].approvedBy = "MGR001";
    records[idx].notifiedManager = true;
    saveLeaveRecords(records);

    const start = new Date(records[idx].startDate);
    const end = new Date(records[idx].endDate);
    const days = Math.floor((end - start) / 86400000) + 1;
    const type = records[idx].type;
    const employeeId = records[idx].employeeId;

    const emps = getEmployees();
    const empIdx = emps.findIndex((e) => e.id === employeeId);
    if (empIdx !== -1) {
      emps[empIdx].leaveBalance.totalTaken += days;
      if (type === "sick") emps[empIdx].leaveBalance.sick.taken += days;
      if (type === "casual") emps[empIdx].leaveBalance.casual.taken += days;
      if (type === "business") emps[empIdx].leaveBalance.business.taken += days;
      if (type === "emergency") emps[empIdx].leaveBalance.emergency.taken += days;
      saveEmployees(emps);
    }

    const employee = getEmployeeById(employeeId);
    if (employee) {
      sendNotification(
        employee.email,
        `[Approved] Your ${type} Leave has been Approved`,
        `Your ${type} leave from ${records[idx].startDate} to ${records[idx].endDate} has been approved by your manager.`
      );
    }

    return { success: true, leave: records[idx] };
  },

  rejectLeave: (leaveId, rejectionReason) => {
    const records = getLeaveRecords();
    const idx = records.findIndex((r) => r.id === leaveId);
    if (idx === -1) return { success: false, error: "Leave not found" };

    const oldStatus = records[idx].status;
    records[idx].status = "rejected";
    records[idx].rejectionReason = rejectionReason;
    records[idx].notifiedManager = true;
    saveLeaveRecords(records);

    const employee = getEmployeeById(records[idx].employeeId);
    if (employee) {
      sendNotification(
        employee.email,
        `[Rejected] Your ${records[idx].type} Leave was Rejected`,
        `Your ${records[idx].type} leave from ${records[idx].startDate} to ${records[idx].endDate} was rejected. Reason: ${rejectionReason}`
      );
    }

    const start = new Date(records[idx].startDate);
    const end = new Date(records[idx].endDate);
    const days = Math.floor((end - start) / 86400000) + 1;

    const emps = getEmployees();
    const empIdx = emps.findIndex((e) => e.id === records[idx].employeeId);
    if (empIdx !== -1) {
      if (oldStatus === "auto-approved" || oldStatus === "approved") {
        emps[empIdx].leaveBalance.totalTaken = Math.max(0, emps[empIdx].leaveBalance.totalTaken - days);
        if (records[idx].type === "sick")
          emps[empIdx].leaveBalance.sick.taken = Math.max(0, emps[empIdx].leaveBalance.sick.taken - days);
        if (records[idx].type === "casual")
          emps[empIdx].leaveBalance.casual.taken = Math.max(0, emps[empIdx].leaveBalance.casual.taken - days);
        if (records[idx].type === "business")
          emps[empIdx].leaveBalance.business.taken = Math.max(0, emps[empIdx].leaveBalance.business.taken - days);
        if (records[idx].type === "emergency")
          emps[empIdx].leaveBalance.emergency.taken = Math.max(0, emps[empIdx].leaveBalance.emergency.taken - days);
      }
      saveEmployees(emps);
    }

    return { success: true, leave: records[idx] };
  },

  approveCancellation: (leaveId) => {
    const records = getLeaveRecords();
    const idx = records.findIndex((r) => r.id === leaveId);
    if (idx === -1) return { success: false, error: "Leave not found" };

    const leave = records[idx];

    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    const days = Math.floor((end - start) / 86400000) + 1;

    const emps = getEmployees();
    const empIdx = emps.findIndex((e) => e.id === leave.employeeId);
    if (empIdx !== -1) {
      emps[empIdx].leaveBalance.totalTaken = Math.max(0, emps[empIdx].leaveBalance.totalTaken - days);
      if (leave.type === "sick")
        emps[empIdx].leaveBalance.sick.taken = Math.max(0, emps[empIdx].leaveBalance.sick.taken - days);
      if (leave.type === "casual")
        emps[empIdx].leaveBalance.casual.taken = Math.max(0, emps[empIdx].leaveBalance.casual.taken - days);
      if (leave.type === "business")
        emps[empIdx].leaveBalance.business.taken = Math.max(0, emps[empIdx].leaveBalance.business.taken - days);
      if (leave.type === "emergency")
        emps[empIdx].leaveBalance.emergency.taken = Math.max(0, emps[empIdx].leaveBalance.emergency.taken - days);
      saveEmployees(emps);
    }

    records.splice(idx, 1);
    saveLeaveRecords(records);

    const employee = getEmployeeById(leave.employeeId);
    if (employee) {
      sendNotification(
        employee.email,
        `[Cancelled] Your ${leave.type} Leave has been Cancelled`,
        `Your ${leave.type} leave (${leave.startDate} to ${leave.endDate}) cancellation was approved. ${days} day(s) returned to your balance.`
      );
    }

    return { success: true };
  },

  rejectCancellation: (leaveId) => {
    const records = getLeaveRecords();
    const idx = records.findIndex((r) => r.id === leaveId);
    if (idx === -1) return { success: false, error: "Leave not found" };

    records[idx].status = records[idx].status === "cancellation-pending" ? "approved" : records[idx].status;
    records[idx].notifiedManager = true;
    saveLeaveRecords(records);

    return { success: true, leave: records[idx] };
  },

  getPendingRequests: (managerId) => {
    const records = getLeaveRecords();
    const employees = getEmployees();
    const team = employees.filter((e) => e.managerId === managerId);
    const teamIds = team.map((e) => e.id);
    return records.filter(
      (r) => teamIds.includes(r.employeeId) && r.status === "pending"
    );
  },

  getCancellationRequests: (managerId) => {
    const records = getLeaveRecords();
    const employees = getEmployees();
    const team = employees.filter((e) => e.managerId === managerId);
    const teamIds = team.map((e) => e.id);
    return records.filter(
      (r) => teamIds.includes(r.employeeId) && r.status === "cancellation-pending"
    );
  },

  getTeamLeaves: (managerId) => {
    const records = getLeaveRecords();
    const employees = getEmployees();
    const team = employees.filter((e) => e.managerId === managerId);
    const teamIds = team.map((e) => e.id);
    return records.filter(
      (r) => teamIds.includes(r.employeeId) && (r.status === "approved" || r.status === "auto-approved")
    );
  },

  getTeamLeaveRequests: (managerId) => {
    const records = getLeaveRecords();
    const employees = getEmployees();
    const team = employees.filter((e) => e.managerId === managerId);
    const teamIds = team.map((e) => e.id);
    return records.filter((r) => teamIds.includes(r.employeeId));
  },

  getTeamMembers: (managerId) => {
    const employees = getEmployees();
    return employees.filter((e) => e.managerId === managerId);
  },

  setProjectTag: (employeeId, projectName) => {
    const emps = getEmployees();
    const idx = emps.findIndex((e) => e.id === employeeId);
    if (idx === -1) return { success: false, error: "Employee not found" };
    emps[idx].projectTag = projectName || null;
    saveEmployees(emps);
    return { success: true, employee: emps[idx] };
  },

  deleteEmployee: (employeeId) => {
    const emps = getEmployees();
    const idx = emps.findIndex((e) => e.id === employeeId);
    if (idx === -1) return { success: false, error: "Employee not found" };
    if (emps[idx].role !== "employee") return { success: false, error: "Can only delete employees" };
    emps.splice(idx, 1);
    saveEmployees(emps);
    const records = getLeaveRecords();
    const filtered = records.filter((r) => r.employeeId !== employeeId);
    saveLeaveRecords(filtered);
    const notifs = getNotifications();
    const filteredNotifs = notifs.filter((n) => !n.message?.includes(employeeId) && !n.to?.includes(employeeId));
    saveNotifications(filteredNotifs);
    return { success: true };
  },

  genPassword: () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let pwd = "";
    for (let i = 0; i < 8; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd;
  },

  addEmployee: (employeeData) => {
    const emps = getEmployees();
    const empCount = emps.filter((e) => e.role === "employee").length + 1;
    const newId = "EMP" + String(empCount).padStart(3, "0");
    const newPassword = mockApi.genPassword();

    let totalAccrued = 0;
    if (employeeData.doj) {
      const doj = new Date(employeeData.doj);
      const now = new Date();
      const monthsSinceJoining = Math.max(0, (now.getFullYear() - doj.getFullYear()) * 12 + (now.getMonth() - doj.getMonth()));
      totalAccrued = monthsSinceJoining * 2;
    }

    const newEmployee = {
      id: newId,
      ...employeeData,
      password: newPassword,
      role: "employee",
      projectTag: employeeData.projectTag || null,
      managerId: "MGR001",
      leaveBalance: {
        sick: { taken: 0, limit: Math.min(2, totalAccrued) },
        casual: { taken: 0, limit: Math.min(1, totalAccrued) },
        business: { taken: 0, limit: Math.min(10, totalAccrued) },
        emergency: { taken: 0, limit: Math.min(4, totalAccrued) },
        totalAccrued,
        totalTaken: 0,
      },
    };
    emps.push(newEmployee);
    saveEmployees(emps);

    sendNotification(
      "manager",
      `[New Employee] ${newEmployee.name} has joined`,
      `${newEmployee.name} (${newEmployee.id}) has been added to your team. Email: ${newEmployee.email}`
    );

    sendNotification(
      newEmployee.email,
      "🎉 Welcome to the Team!",
      `Welcome ${newEmployee.name}! Your account is ready.\nID: ${newEmployee.id}\nEmail: ${newEmployee.email}\nPassword: ${newPassword}\n\nLogin at the app with these credentials.`
    );

    fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: newEmployee.email,
        subject: "Welcome to LeaveFlow - Your Account Credentials",
        html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
          <h2 style="color:#1d4ed8">Welcome to LeaveFlow! 🎉</h2>
          <p>Hi <strong>${newEmployee.name}</strong>,</p>
          <p>Your employee account has been created. Here are your login credentials:</p>
          <table style="width:100%;background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0">
            <tr><td style="color:#6b7280;padding:4px 8px">Employee ID</td><td style="font-weight:600">${newEmployee.id}</td></tr>
            <tr><td style="color:#6b7280;padding:4px 8px">Email</td><td style="font-weight:600">${newEmployee.email}</td></tr>
            <tr><td style="color:#6b7280;padding:4px 8px">Password</td><td style="font-family:monospace;font-weight:700;color:#d97706">${newPassword}</td></tr>
          </table>
          <p style="font-size:14px;color:#6b7280">Login at <a href="http://localhost:5100/login" style="color:#1d4ed8">http://localhost:5100/login</a> and change your password.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
          <p style="font-size:12px;color:#9ca3af">This is an automated message from LeaveFlow.</p>
        </div>`,
      }),
    }).catch(() => {});

    const hrUser = emps.find((e) => e.role === "hr");
    addNotification({
      type: "in-app",
      to: "HR",
      subject: `Employee ${newEmployee.id} created`,
      message: `${newEmployee.name} (${newEmployee.email}) has been onboarded successfully.`,
      email: hrUser?.email || "hr@company.com",
    });

    return { success: true, employee: newEmployee };
  },

  getAllEmployees: () => {
    return getEmployees().filter((e) => e.role === "employee");
  },
};
