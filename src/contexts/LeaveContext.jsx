import { createContext, useContext, useState, useCallback } from "react";
import { api } from "../services/api";

const LeaveContext = createContext();

export function LeaveProvider({ children }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const getBalance = useCallback((employeeId) => {
    return api.getLeaveBalance(employeeId);
  }, []);

  const getHistory = useCallback((employeeId, limit = 10) => {
    return api.getLeaveHistory(employeeId, limit);
  }, []);

  const getUpcoming = useCallback((employeeId) => {
    return api.getUpcomingLeaves(employeeId);
  }, []);

  const applyLeave = useCallback((employeeId, type, startDate, endDate, reason, document) => {
    return api.applyLeave({ employeeId, leaveType: type, startDate, endDate, reason, document }).then((r) => {
      refresh();
      return r;
    });
  }, [refresh]);

  const cancelLeave = useCallback((leaveId, reason) => {
    return api.cancelLeave(leaveId, reason).then((r) => {
      refresh();
      return r;
    });
  }, [refresh]);

  const approveLeave = useCallback((leaveId) => {
    return api.approveLeave(leaveId).then((r) => {
      refresh();
      return r;
    });
  }, [refresh]);

  const rejectLeave = useCallback((leaveId, reason) => {
    return api.rejectLeave(leaveId, reason).then((r) => {
      refresh();
      return r;
    });
  }, [refresh]);

  const approveCancellation = useCallback((leaveId) => {
    return api.approveCancellation(leaveId).then((r) => {
      refresh();
      return r;
    });
  }, [refresh]);

  const rejectCancellation = useCallback((leaveId) => {
    return api.rejectCancellation(leaveId).then((r) => {
      refresh();
      return r;
    });
  }, [refresh]);

  const getPendingRequests = useCallback((managerId) => {
    return api.getPendingRequests(managerId);
  }, []);

  const getCancellationRequests = useCallback((managerId) => {
    return api.getCancellationRequests(managerId);
  }, []);

  const getTeamLeaves = useCallback((managerId) => {
    return api.getTeamLeaves(managerId);
  }, []);

  const getTeamLeaveRequests = useCallback((managerId) => {
    return api.getTeamLeaveRequests(managerId);
  }, []);

  return (
    <LeaveContext.Provider
      value={{
        refreshKey,
        getBalance,
        getHistory,
        getUpcoming,
        applyLeave,
        cancelLeave,
        approveLeave,
        rejectLeave,
        approveCancellation,
        rejectCancellation,
        getPendingRequests,
        getCancellationRequests,
        getTeamLeaves,
        getTeamLeaveRequests,
        refresh,
      }}
    >
      {children}
    </LeaveContext.Provider>
  );
}

export const useLeave = () => useContext(LeaveContext);
