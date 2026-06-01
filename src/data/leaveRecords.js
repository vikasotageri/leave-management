const LEAVE_VERSION = "v3";

export const generateId = () => "L" + Date.now().toString(36).toUpperCase();

export const getDefaultLeaveRecords = () => {
  return [];
};

export const getLeaveRecords = () => {
  const stored = localStorage.getItem("leaveRecords");
  const version = localStorage.getItem("leaveRecords_version");
  if (stored && version === LEAVE_VERSION) return JSON.parse(stored);
  const defaults = getDefaultLeaveRecords();
  localStorage.setItem("leaveRecords", JSON.stringify(defaults));
  localStorage.setItem("leaveRecords_version", LEAVE_VERSION);
  return defaults;
};

export const saveLeaveRecords = (records) => {
  localStorage.setItem("leaveRecords", JSON.stringify(records));
};
