import { useState, useEffect } from "react";
import { useLeave } from "../../contexts/LeaveContext";
import { useAuth } from "../../contexts/AuthContext";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";

export function UpcomingLeaves() {
  const { user } = useAuth();
  const { getUpcoming, cancelLeave, refreshKey } = useLeave();
  const [leaves, setLeaves] = useState([]);
  const [cancelId, setCancelId] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (user) getUpcoming(user.id).then(setLeaves);
  }, [user, getUpcoming, refreshKey]);

  const handleCancel = async () => {
    if (!cancelId || !cancelReason) return;
    await cancelLeave(cancelId, cancelReason);
    setShowModal(false);
    setCancelId(null);
    setCancelReason("");
    if (user) getUpcoming(user.id).then(setLeaves);
  };

  const getTypeLabel = (type) => {
    const labels = { sick: "Sick", casual: "Casual", emergency: "Emergency", vacation: "Vacation" };
    return labels[type] || type;
  };

  if (leaves.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Upcoming Leaves</h3>
        {leaves.length > 10 && <span className="text-[10px] text-gray-400">{leaves.length} total</span>}
      </div>
      <div className="divide-y divide-gray-50 max-h-[380px] overflow-y-auto custom-scroll">
        {leaves.slice(0, 10).map((leave) => (
          <div key={leave.id} className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium capitalize">{getTypeLabel(leave.type)}</p>
              <p className="text-sm text-gray-500">📅 {leave.startDate}</p>
              <p className="text-xs text-gray-400">{leave.reason}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge status={leave.status} />
              {(leave.status === "approved" || leave.status === "auto-approved" || leave.status === "pending") && (
                <Button variant="danger" className="text-xs !px-3 !py-1" onClick={() => { setCancelId(leave.id); setShowModal(true); }}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Cancel Leave</h3>
            <p className="text-sm text-gray-600 mb-3">Please provide a reason for cancellation:</p>
            <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-4" placeholder="Reason for cancellation..." />
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button>
              <Button variant="danger" onClick={handleCancel} disabled={!cancelReason}>Submit Cancellation</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
