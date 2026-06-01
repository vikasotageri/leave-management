import { useState, useEffect } from "react";
import { useLeave } from "../../contexts/LeaveContext";
import { useAuth } from "../../contexts/AuthContext";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";

export function PendingRequests() {
  const { user } = useAuth();
  const { getPendingRequests, approveLeave, rejectLeave, refreshKey } = useLeave();
  const [requests, setRequests] = useState([]);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  useEffect(() => {
    if (user) getPendingRequests(user.id).then(setRequests);
  }, [user, getPendingRequests, refreshKey]);

  const handleApprove = async (id) => {
    const res = await approveLeave(id);
    if (res.success) setActionMsg("Leave approved!");
    getPendingRequests(user.id).then(setRequests);
    setTimeout(() => setActionMsg(""), 3000);
  };

  const handleReject = async () => {
    if (!rejectId || !rejectReason) return;
    const res = await rejectLeave(rejectId, rejectReason);
    if (res.success) setActionMsg("Leave rejected!");
    setRejectId(null);
    setRejectReason("");
    getPendingRequests(user.id).then(setRequests);
    setTimeout(() => setActionMsg(""), 3000);
  };

  const getTypeLabel = (t) => ({ sick: "Sick", casual: "Casual", emergency: "Emergency" }[t] || t);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Pending Leave Requests</h3>
        {actionMsg && <span className="text-sm text-green-600 font-medium">{actionMsg}</span>}
      </div>
      {requests.length === 0 ? (
        <div className="p-6 text-center text-gray-400">No pending requests</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {requests.map((r) => (
            <div key={r.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{r.employeeName}</p>
                  <p className="text-sm text-gray-500 capitalize">{getTypeLabel(r.type)} &middot; {r.startDate} → {r.endDate}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Reason: {r.reason}</p>
                  <p className="text-xs text-gray-400">Applied: {r.appliedOn}</p>
                </div>
                <Badge status={r.status} />
              </div>
              <div className="flex gap-2 mt-3">
                <Button variant="success" className="!px-4 !py-1.5 text-sm" onClick={() => handleApprove(r.id)}>
                  Approve
                </Button>
                <Button
                  variant="danger"
                  className="!px-4 !py-1.5 text-sm"
                  onClick={() => { setRejectId(r.id); setRejectReason(""); }}
                >
                  Reject
                </Button>
              </div>
              {rejectId === r.id && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection..."
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none resize-none"
                    rows={2}
                  />
                  <div className="flex gap-2 mt-2">
                    <Button variant="danger" className="text-xs !px-3 !py-1" onClick={handleReject} disabled={!rejectReason}>
                      Confirm Reject
                    </Button>
                    <Button variant="secondary" className="text-xs !px-3 !py-1" onClick={() => setRejectId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
