export const leavePolicies = {
  monthlyCredit: 2,
  yearlyMax: 24,
  carryForward: true,
  maxAdvanceMonths: 2,
  leaveTypes: {
    sick: {
      label: "Sick Leave",
      monthlyLimit: 2,
      yearlyLimit: null,
      autoApprovalDays: 3,
    },
    casual: {
      label: "Casual Leave",
      monthlyLimit: 1,
      yearlyLimit: null,
      autoApprovalDays: 3,
    },
    business: {
      label: "Business",
      monthlyLimit: 10,
      yearlyLimit: null,
      autoApprovalDays: 3,
    },
    emergency: {
      label: "Emergency/Personal/Family",
      monthlyLimit: 4,
      yearlyLimit: 15,
      autoApprovalDays: 3,
    },
  },
  autoApprovalRules: {
    sickCasualCombinedMax: 3,
    cancellationWindowDays: 70,
  },
};

export const getLeavePolicy = () => leavePolicies;

export const getLeaveTypeLabel = (type) => {
  return leavePolicies.leaveTypes[type]?.label || type;
};

export const getMonthlyLimit = (type) => {
  return leavePolicies.leaveTypes[type]?.monthlyLimit || 0;
};

export const getYearlyLimit = (type) => {
  return leavePolicies.leaveTypes[type]?.yearlyLimit || 24;
};
