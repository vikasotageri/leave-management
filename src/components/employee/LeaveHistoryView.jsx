import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useLeave } from "../../contexts/LeaveContext";

const statusLabels = {
  "auto-approved": "Auto-Approved",
  approved: "Approved",
  pending: "Pending",
  rejected: "Rejected",
  "cancellation-pending": "Cancellation Pending",
  cancelled: "Cancelled",
  "auto-cancelled": "Auto-Cancelled",
};

const statusColors = {
  "auto-approved": "bg-green-100 text-green-800 border-green-300",
  approved: "bg-blue-100 text-blue-800 border-blue-300",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  rejected: "bg-red-100 text-red-800 border-red-300",
  "cancellation-pending": "bg-purple-100 text-purple-800 border-purple-300",
  cancelled: "bg-gray-100 text-gray-800 border-gray-300",
  "auto-cancelled": "bg-gray-100 text-gray-800 border-gray-300",
};

export function LeaveHistoryView() {
  const { user } = useAuth();
  const { getHistory, cancelLeave, refreshKey } = useLeave();
  const [leaves, setLeaves] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [showCancel, setShowCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState("");

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

  const perPage = 20;
  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  if (safePage !== page) setPage(safePage);
  const pageLeaves = filtered.slice(safePage * perPage, safePage * perPage + perPage);

  const getTypeLabel = (type) => {
    const labels = { sick: "Sick", casual: "Casual", business: "Business", emergency: "Emergency" };
    return labels[type] || type;
  };

  const isPending = (status) => status === "pending";
  const isApproved = (status) => status === "approved" || status === "auto-approved";

  const handleCancel = async (leaveId, status) => {
    if (isPending(status)) {
      await cancelLeave(leaveId, "");
      setShowCancel(null);
      return;
    }
    if (!cancelReason.trim()) return;
    await cancelLeave(leaveId, cancelReason);
    setShowCancel(null);
    setCancelReason("");
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 Applied Leave History</h3>
      <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search by Request ID or date..." className="w-full max-w-sm px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-400 mb-3" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2.5 text-gray-500 font-medium text-[11px] whitespace-nowrap">Request ID</th>
              <th className="text-left p-2.5 text-gray-500 font-medium text-[11px] whitespace-nowrap">Date</th>
              <th className="text-left p-2.5 text-gray-500 font-medium text-[11px] whitespace-nowrap">Time</th>
              <th className="text-left p-2.5 text-gray-500 font-medium text-[11px]">Type</th>
              <th className="text-left p-2.5 text-gray-500 font-medium text-[11px]">Reason</th>
              <th className="text-left p-2.5 text-gray-500 font-medium text-[11px] whitespace-nowrap">Leave Date</th>
              <th className="text-left p-2.5 text-gray-500 font-medium text-[11px]">Status</th>
              <th className="text-left p-2.5 text-gray-500 font-medium text-[11px]"></th>
            </tr>
          </thead>
          <tbody>
            {pageLeaves.length === 0 ? (
              <tr><td colSpan={8} className="p-4 text-center text-gray-400 text-xs">{leaves.length === 0 ? "No leave records" : "No matches"}</td></tr>
            ) : (
              pageLeaves.map((leave) => (
                <tr key={leave.id} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="p-2.5 font-mono text-[10px] text-gray-500">{leave.id}</td>
                  <td className="p-2.5 text-[11px] text-gray-600 whitespace-nowrap">{leave.appliedOn.slice(0, 10)}</td>
                  <td className="p-2.5 text-[11px] text-gray-500 whitespace-nowrap">{leave.appliedOn.slice(11, 19)}</td>
                  <td className="p-2.5 text-[11px] capitalize font-medium">{getTypeLabel(leave.type)}</td>
                  <td className="p-2.5 max-w-[150px] truncate text-[11px] text-gray-600" title={leave.reason}>{leave.reason}</td>
                  <td className="p-2.5 text-[11px] whitespace-nowrap">{leave.startDate}</td>
                  <td className="p-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColors[leave.status] || "bg-gray-100 text-gray-800 border-gray-300"}`}>
                      {statusLabels[leave.status] || leave.status}
                    </span>
                  </td>
                  <td className="p-2.5 whitespace-nowrap">
                    {isPending(leave.status) ? (
                      <button onClick={() => handleCancel(leave.id, leave.status)} className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded text-[10px] font-medium hover:bg-red-100 cursor-pointer">Cancel</button>
                    ) : isApproved(leave.status) ? (
                      showCancel === leave.id ? (
                        <div className="flex items-center gap-1">
                          <input type="text" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason..." className="w-20 p-0.5 text-[10px] border border-gray-300 rounded outline-none" />
                          <button onClick={() => handleCancel(leave.id, leave.status)} className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] rounded hover:bg-red-600 cursor-pointer">Go</button>
                          <button onClick={() => { setShowCancel(null); setCancelReason(""); }} className="px-1.5 py-0.5 bg-gray-200 text-[9px] rounded hover:bg-gray-300 cursor-pointer">X</button>
                        </div>
                      ) : (
                        <button onClick={() => setShowCancel(leave.id)} className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded text-[10px] font-medium hover:bg-red-100 cursor-pointer">Cancel</button>
                      )
                    ) : leave.status === "cancellation-pending" ? (
                      <span className="text-[10px] text-purple-600 font-medium">Awaiting</span>
                    ) : (
                      <span className="text-gray-300 text-[10px]">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-3">
        <p className="text-[11px] text-gray-400">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</p>
        <div className="flex gap-2">
          <button disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="px-3 py-1 text-[11px] font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">&larr; Previous 20</button>
          <button disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)} className="px-3 py-1 text-[11px] font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">Next 20 &rarr;</button>
        </div>
      </div>
    </div>
  );
}