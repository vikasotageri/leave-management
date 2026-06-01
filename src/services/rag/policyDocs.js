export const policyChunks = [
  {
    id: "accrual",
    title: "Leave Accrual",
    content: "Employees earn 2 leave days per month of service. Maximum 24 days per year. Leave is credited automatically on the 1st of each month. Unused leaves can be carried forward to next year up to 12 days.",
    keywords: ["accrual", "credit", "earn", "per month", "carry forward", "maximum"],
  },
  {
    id: "sick-leave",
    title: "Sick Leave Policy",
    content: "Sick leave: maximum 2 days per month. Can be used for personal illness, medical appointments, or family medical emergencies. No prior approval needed for sick leave, but must inform manager within 24 hours.",
    keywords: ["sick", "illness", "medical", "doctor", "health"],
  },
  {
    id: "casual-leave",
    title: "Casual Leave Policy",
    content: "Casual leave: maximum 1 day per month. Can be used for personal reasons, family events, or routine appointments. Requires at least 1 day advance notice.",
    keywords: ["casual", "personal", "family", "event", "appointment"],
  },
  {
    id: "business-leave",
    title: "Business Leave Policy",
    content: "Business leave: maximum 10 days per month. Used for client visits, conferences, training, or work-related travel. Business leave always requires manager approval — no auto-approval.",
    keywords: ["business", "client", "conference", "training", "work travel", "meeting"],
  },
  {
    id: "emergency-leave",
    title: "Emergency Leave Policy",
    content: "Emergency leave: maximum 4 days per month and 15 days per year. For urgent situations like family emergencies, accidents, or unforeseen circumstances. Can be applied on the same day.",
    keywords: ["emergency", "urgent", "accident", "unforeseen", "crisis"],
  },
  {
    id: "auto-approval",
    title: "Auto-Approval Rules",
    content: "Auto-approval happens when all conditions are met: within monthly limits, not an extension of existing leave, no team conflict on same date, and employee is not project-tagged. Business leave is never auto-approved. Project-tagged employees always go to manager.",
    keywords: ["auto-approve", "automatic", "auto approval", "without manager", "instant"],
  },
  {
    id: "manager-approval",
    title: "Manager Approval",
    content: "Leaves that require manager approval: business leave, project-tagged employees, leave extensions, leaves exceeding monthly limits, emergency leave over 2 days. Manager gets notified and can approve or reject with reason.",
    keywords: ["manager", "approval", "pending", "review", "reject", "notify"],
  },
  {
    id: "cancellation",
    title: "Leave Cancellation Policy",
    content: "Cancellation window is 70 days from the leave start date. Pending leaves are auto-cancelled instantly without reason. Approved leaves require a reason and become cancellation-pending until manager approves the cancellation. On cancellation approval, leave balance is refunded.",
    keywords: ["cancel", "cancellation", "refund", "auto-cancel", "cancellation-pending"],
  },
  {
    id: "advance-booking",
    title: "Advance Booking",
    content: "Leaves can be booked up to 2 months in advance. Cannot book beyond 60 days from today. Weekends and public holidays do not count as leave days.",
    keywords: ["advance", "booking", "future", "ahead", "2 months", "60 days", "pre-book"],
  },
  {
    id: "project-tagging",
    title: "Project Tagging",
    content: "Employees can be tagged to specific projects by their manager. Tagged employees' leaves always require manager approval regardless of limits. Managers can assign or remove project tags.",
    keywords: ["project", "tag", "tagged", "project-tagged", "assignment"],
  },
  {
    id: "leave-balance",
    title: "Leave Balance",
    content: "Total accrued = months since join date × 2. Balance is deducted only when leave is approved (auto or by manager). Pending leaves do not deduct balance. Rejected leaves refund the balance. Cancellation-approved leaves also refund.",
    keywords: ["balance", "accrued", "remaining", "deduct", "refund", "taken"],
  },
  {
    id: "roles",
    title: "Roles & Responsibilities",
    content: "Three roles: Employee can apply and cancel their own leaves. Manager can approve/reject leaves, tag employees to projects, view team dashboard and AI analytics. HR can create employees, view all profiles, and see leave data across the organization.",
    keywords: ["employee", "manager", "hr", "role", "responsibility", "permission"],
  },
];
