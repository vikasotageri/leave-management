import { useState, useEffect } from "react";
import { useLeave } from "../../contexts/LeaveContext";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../common/Button";

export function CancellationRequests() {
  const { user } = useAuth();
  const { getCancellationRequests, approveCancellation, rejectCancellation, refreshKey } = useLeave();
  const [requests, setRequests] = useState([]);
  const [actionMsg, setActionMsg] = useState("");

  useEffect(() => {
    if (user) getCancellationRequests(user.id).then(setRequests);
  }, [user, getCancellationRequests, refreshKey]);

  const handleApprove = async (id) => {
    const res = await approveCancellation(id);
    if (res.success) setActionMsg("Cancellation approved! Days returned.");
    getCancellationRequests(user.id).then(setRequests);
    setTimeout(() => setActionMsg(""), 3000);
  };

  const handleReject = async (id) => {
    const res = await rejectCancellation(id);
    if (res.success) setActionMsg("Cancellation rejected.");
    getCancellationRequests(user.id).then(setRequests);
    setTimeout(() => setActionMsg(""), 3000);
  };

  if (requests.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Cancellation Requests</h3>
        {actionMsg && <span className={`text-sm font-medium ${actionMsg.includes("returned") ? "text-green-600" : "text-orange-600"}`}>{actionMsg}</span>}
      </div>
      <div className="divide-y divide-gray-50">
        {requests.map((r) => (
          <div key={r.id} className="p-4">
            <div className="flex justify-between">
              <div>
                <p className="font-medium">{r.employeeName} wants to cancel {r.type} leave</p>
                <p className="text-sm text-gray-500">{r.startDate} → {r.endDate}</p>
                <p className="text-xs text-gray-400 mt-1">Cancellation reason: {r.cancellationReason}</p>
                <p className="text-xs text-gray-400">Original reason: {r.reason}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button variant="success" className="!px-4 !py-1.5 text-sm" onClick={() => handleApprove(r.id)}>
                Approve Cancellation
              </Button>
              <Button variant="secondary" className="!px-4 !py-1.5 text-sm" onClick={() => handleReject(r.id)}>
                Reject
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
