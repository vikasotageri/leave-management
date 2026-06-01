import { useState, useEffect } from "react";
import { useLeave } from "../../contexts/LeaveContext";
import { useAuth } from "../../contexts/AuthContext";

const statusStyles = {
  "auto-approved": "bg-green-100 text-green-800 border-green-300",
  approved: "bg-blue-100 text-blue-800 border-blue-300",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  rejected: "bg-red-100 text-red-800 border-red-300",
  "cancellation-pending": "bg-purple-100 text-purple-800 border-purple-300",
  cancelled: "bg-gray-100 text-gray-800 border-gray-300",
  "auto-cancelled": "bg-gray-100 text-gray-800 border-gray-300",
};

const statusLabels = {
  "auto-approved": "Request Auto-Approved",
  approved: "Request Approved",
  pending: "Request Pending",
  rejected: "Request Rejected",
  "cancellation-pending": "Cancellation Request Pending",
  cancelled: "Cancelled",
  "auto-cancelled": "Auto-Cancelled",
};

export function LeaveHistory() {
  const { user } = useAuth();
  const { getHistory, cancelLeave, refreshKey } = useLeave();
  const [leaves, setLeaves] = useState([]);
  const [search, setSearch] = useState("");
  const [showCancel, setShowCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [docViewer, setDocViewer] = useState(null);

  useEffect(() => {
    if (user) getHistory(user.id, 200).then(setLeaves);
  }, [user, getHistory, refreshKey]);

  const filtered = leaves
    .filter((l) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return l.id.toLowerCase().includes(q) || l.startDate.includes(q);
    })
    .sort((a, b) => b.appliedOn.localeCompare(a.appliedOn));

  const getTypeLabel = (type) => {
    const labels = { sick: "Sick", casual: "Casual", business: "Business", emergency: "Emergency" };
    return labels[type] || type;
  };

  const isPending = (status) => status === "pending";
  const isApproved = (status) => status === "approved" || status === "auto-approved";
  const canCancel = (status) => isPending(status) || isApproved(status);

  const handleCancel = async (leaveId, status) => {
    if (isPending(status)) {
      await cancelLeave(leaveId, "");
      return;
    }
    if (!cancelReason.trim()) return;
    await cancelLeave(leaveId, cancelReason);
    setShowCancel(null);
    setCancelReason("");
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {docViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDocViewer(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-[90vw] h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">Document</h3>
              <button onClick={() => setDocViewer(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none cursor-pointer bg-transparent border-none"
              >&times;</button>
            </div>
            <div className="flex-1 p-4 overflow-auto">
              {docViewer.startsWith("data:application/pdf") ? (
                <iframe src={docViewer} className="w-full h-full rounded-lg" title="Document" />
              ) : (
                <embed src={docViewer} className="w-full h-full rounded-lg" type={docViewer.startsWith("data:image") ? "image/*" : "application/octet-stream"} />
              )}
            </div>
          </div>
        </div>
      )}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
        <h3 className="font-semibold text-gray-800">Leave History</h3>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by Request ID or date..." className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-400 w-64" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 text-gray-500 font-medium whitespace-nowrap">Request ID</th>
              <th className="text-left p-3 text-gray-500 font-medium whitespace-nowrap">Date</th>
              <th className="text-left p-3 text-gray-500 font-medium whitespace-nowrap">Time</th>
              <th className="text-left p-3 text-gray-500 font-medium">Type</th>
              <th className="text-left p-3 text-gray-500 font-medium">Reason</th>
              <th className="text-left p-3 text-gray-500 font-medium">Document</th>
              <th className="text-left p-3 text-gray-500 font-medium whitespace-nowrap">Leave Date</th>
              <th className="text-left p-3 text-gray-500 font-medium">Status</th>
              <th className="text-left p-3 text-gray-500 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="p-6 text-center text-gray-400">{leaves.length === 0 ? "No leave records found" : "No records match your search"}</td></tr>
            ) : (
              filtered.map((leave) => (
                <tr key={leave.id} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="p-3 font-mono text-xs text-gray-500">{leave.id}</td>
                  <td className="p-3 text-gray-600 whitespace-nowrap">{leave.appliedOn.slice(0, 10)}</td>
                  <td className="p-3 text-gray-500 whitespace-nowrap">{leave.appliedOn.slice(11, 19)}</td>
                  <td className="p-3 capitalize font-medium">{getTypeLabel(leave.type)}</td>
                  <td className="p-3 max-w-[180px] truncate text-gray-600" title={leave.reason}>{leave.reason}</td>
                  <td className="p-3">
                    {leave.document ? (
                      <button onClick={() => setDocViewer(leave.document)} className="text-blue-600 underline text-xs bg-transparent border-none p-0 cursor-pointer">View</button>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="p-3 whitespace-nowrap">{leave.startDate}</td>
                  <td className="p-3">
                    <span className={`px-3 py-1 rounded-full text-[11px] font-medium border ${statusStyles[leave.status] || "bg-gray-100 text-gray-800 border-gray-300"}`}>
                      {statusLabels[leave.status] || leave.status}
                    </span>
                  </td>
                  <td className="p-3">
                    {isPending(leave.status) ? (
                      <button onClick={() => handleCancel(leave.id, leave.status)} className="px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg text-[11px] font-medium hover:bg-red-100 cursor-pointer">Cancel</button>
                    ) : isApproved(leave.status) ? (
                      showCancel === leave.id ? (
                        <div className="flex items-center gap-1">
                          <input type="text" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason..." className="w-28 p-1 text-[11px] border border-gray-300 rounded outline-none" />
                          <button onClick={() => handleCancel(leave.id, leave.status)} className="px-2 py-1 bg-red-500 text-white text-[10px] rounded hover:bg-red-600 cursor-pointer">Confirm</button>
                          <button onClick={() => { setShowCancel(null); setCancelReason(""); }} className="px-2 py-1 bg-gray-200 text-[10px] rounded hover:bg-gray-300 cursor-pointer">X</button>
                        </div>
                      ) : (
                        <button onClick={() => setShowCancel(leave.id)} className="px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg text-[11px] font-medium hover:bg-red-100 cursor-pointer">Cancel</button>
                      )
                    ) : leave.status === "cancellation-pending" ? (
                      <span className="text-[11px] text-purple-600 font-medium">Awaiting</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
