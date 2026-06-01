import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useLeave } from "../../contexts/LeaveContext";
import { api } from "../../services/api";
import { Button } from "../common/Button";

const statusColors = {
  "auto-approved": "bg-green-100 text-green-700",
  approved: "bg-blue-100 text-blue-700",
  pending: "bg-yellow-100 text-yellow-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-700",
  "auto-cancelled": "bg-red-100 text-red-700",
  "cancellation-pending": "bg-orange-100 text-orange-700",
};

const typeColors = {
  sick: "bg-red-100 text-red-700",
  casual: "bg-green-100 text-green-700",
  emergency: "bg-purple-100 text-purple-700",
  vacation: "bg-blue-100 text-blue-700",
};

export function TeamApprovalList() {
  const { user } = useAuth();
  const { approveLeave, rejectLeave, approveCancellation, rejectCancellation, refreshKey } = useLeave();
  const [members, setMembers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [records, setRecords] = useState([]);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [historyPage, setHistoryPage] = useState(0);
  const [pendingPage, setPendingPage] = useState(0);
  const [cancelPage, setCancelPage] = useState(0);
  const [docViewer, setDocViewer] = useState(null);
  const perPage = 15;

  useEffect(() => {
    if (user) api.getEmployees().then(setMembers);
  }, [user]);

  useEffect(() => {
    if (user) api.getTeamLeaveRequests(user.id).then(setRecords);
  }, [user, refreshKey]);

  useEffect(() => { setHistoryPage(0); setPendingPage(0); setCancelPage(0); }, [selectedId]);

  const selected = members.find((m) => m.id === selectedId);
  const empRecords = selectedId ? records.filter((r) => r.employeeId === selectedId) : [];
  const pending = empRecords.filter((r) => r.status === "pending");
  const cancellations = empRecords.filter((r) => r.status === "cancellation-pending");

  const doApprove = async (id) => {
    const res = await approveLeave(id);
    if (res.success) setActionMsg("Approved!");
    if (user) api.getTeamLeaveRequests(user.id).then(setRecords);
    setTimeout(() => setActionMsg(""), 2000);
  };

  const doReject = async () => {
    if (!rejectId || !rejectReason) return;
    await rejectLeave(rejectId, rejectReason);
    setActionMsg("Rejected!");
    setRejectId(null);
    setRejectReason("");
    if (user) api.getTeamLeaveRequests(user.id).then(setRecords);
    setTimeout(() => setActionMsg(""), 2000);
  };

  const doApproveCancellation = async (id) => {
    await approveCancellation(id);
    setActionMsg("Cancellation approved!");
    if (user) api.getTeamLeaveRequests(user.id).then(setRecords);
    setTimeout(() => setActionMsg(""), 2000);
  };

  const doRejectCancellation = async (id) => {
    await rejectCancellation(id);
    setActionMsg("Cancellation rejected!");
    if (user) api.getTeamLeaveRequests(user.id).then(setRecords);
    setTimeout(() => setActionMsg(""), 2000);
  };

  if (selectedId && selected) {
    return (
      <div className="space-y-6">
        {docViewer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDocViewer(null)}>
            <div className="bg-white rounded-xl shadow-2xl w-[90vw] h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-800">Document</h3>
                <button
                  onClick={() => setDocViewer(null)}
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelectedId(null); setRejectId(null); setDocViewer(null); }}
            className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
          >&larr; Back to team</button>
          <span className="text-gray-300">|</span>
          <span className="font-semibold text-gray-800">{selected.name}</span>
          <span className="text-xs text-blue-600 font-mono">{selected.id}</span>
        </div>

        {actionMsg && (
          <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium">{actionMsg}</div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-3">Leave Balance</p>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-blue-50 p-3 rounded-lg text-center">
              <p className="text-xs text-gray-500">Sick</p>
              <p className="text-lg font-bold text-blue-600">{selected.leaveBalance.sick.limit - selected.leaveBalance.sick.taken}/{selected.leaveBalance.sick.limit}</p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg text-center">
              <p className="text-xs text-gray-500">Casual</p>
              <p className="text-lg font-bold text-green-600">{selected.leaveBalance.casual.limit - selected.leaveBalance.casual.taken}/{selected.leaveBalance.casual.limit}</p>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg text-center">
              <p className="text-xs text-gray-500">Emergency</p>
              <p className="text-lg font-bold text-purple-600">{selected.leaveBalance.emergency.limit - selected.leaveBalance.emergency.taken}/{selected.leaveBalance.emergency.limit}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg text-center">
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-lg font-bold text-gray-600">{selected.leaveBalance.totalAccrued - selected.leaveBalance.totalTaken}/{selected.leaveBalance.totalAccrued}</p>
            </div>
          </div>
        </div>

        {pending.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Pending Requests ({pending.length})</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {pending.slice(pendingPage * 4, (pendingPage + 1) * 4).map((r) => (
                <div key={r.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-600 font-mono">{r.id}</span>
                        <span className="text-sm text-gray-500 capitalize">{r.type}</span>
                        <span className={`px-2 py-0.5 text-[10px] rounded-full ${statusColors[r.status] || "bg-gray-100"}`}>{r.status}</span>
                      </div>
                      <p className="text-sm text-gray-600">{r.startDate === r.endDate ? r.startDate : `${r.startDate} - ${r.endDate}`}</p>
                      <p className="text-xs text-gray-400">Reason: {r.reason || "N/A"}</p>
                      <p className="text-xs text-gray-400">Applied: {r.appliedOn}</p>
                      {r.document && (
                        <button
                          onClick={() => setDocViewer(r.document)}
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer bg-transparent border-none p-0"
                          title="Click to view document"
                        >📎 View Document</button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button variant="success" className="!px-4 !py-1.5 text-sm" onClick={() => doApprove(r.id)}>
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
                        <Button variant="danger" className="text-xs !px-3 !py-1" onClick={doReject} disabled={!rejectReason}>
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
            {pending.length > 4 && (
              <div className="flex items-center justify-between p-3 border-t border-gray-100">
                <button
                  onClick={() => setPendingPage(Math.max(0, pendingPage - 1))}
                  disabled={pendingPage === 0}
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >← Back 4</button>
                <span className="text-xs text-gray-400">Page {pendingPage + 1} of {Math.ceil(pending.length / 4)}</span>
                <button
                  onClick={() => setPendingPage(Math.min(Math.ceil(pending.length / 4) - 1, pendingPage + 1))}
                  disabled={pendingPage >= Math.ceil(pending.length / 4) - 1}
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >Next 4 →</button>
              </div>
            )}
          </div>
        )}

        {cancellations.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Cancellation Requests ({cancellations.length})</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {cancellations.slice(cancelPage * 4, (cancelPage + 1) * 4).map((r) => (
                <div key={r.id} className="p-4">
                  <p className="text-xs text-blue-600 font-mono">{r.id}</p>
                  <p className="font-medium">Cancel {r.type} leave</p>
                  <p className="text-sm text-gray-500">{r.startDate === r.endDate ? r.startDate : `${r.startDate} - ${r.endDate}`}</p>
                  <p className="text-xs text-gray-400 mt-1">Original reason: {r.reason || "N/A"}</p>
                  <p className="text-xs text-gray-400">Cancellation reason: {r.cancellationReason}</p>
                  {r.document && (
                    <button
                      onClick={() => setDocViewer(r.document)}
                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer mt-0.5 inline-block bg-transparent border-none p-0"
                      title="Click to view document"
                    >📎 View Document</button>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Button variant="success" className="!px-4 !py-1.5 text-sm" onClick={() => doApproveCancellation(r.id)}>
                      Approve Cancellation
                    </Button>
                    <Button variant="secondary" className="!px-4 !py-1.5 text-sm" onClick={() => doRejectCancellation(r.id)}>
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {cancellations.length > 4 && (
              <div className="flex items-center justify-between p-3 border-t border-gray-100">
                <button
                  onClick={() => setCancelPage(Math.max(0, cancelPage - 1))}
                  disabled={cancelPage === 0}
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >← Back 4</button>
                <span className="text-xs text-gray-400">Page {cancelPage + 1} of {Math.ceil(cancellations.length / 4)}</span>
                <button
                  onClick={() => setCancelPage(Math.min(Math.ceil(cancellations.length / 4) - 1, cancelPage + 1))}
                  disabled={cancelPage >= Math.ceil(cancellations.length / 4) - 1}
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >Next 4 →</button>
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Applied Leave History</h3>
            <span className="text-xs text-gray-400">{empRecords.length} total</span>
          </div>
          {empRecords.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">No leave records</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-medium">Request ID</th>
                      <th className="text-left p-3 font-medium">Applied On</th>
                      <th className="text-left p-3 font-medium">Type</th>
                      <th className="text-left p-3 font-medium">Leave Date</th>
                      <th className="text-left p-3 font-medium">Reason</th>
                      <th className="text-left p-3 font-medium">Doc</th>
                      <th className="text-left p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {empRecords
                      .sort((a, b) => new Date(a.appliedOn) - new Date(b.appliedOn))
                      .slice(historyPage * perPage, (historyPage + 1) * perPage)
                      .map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="p-3 text-blue-600 font-mono text-xs">{r.id}</td>
                          <td className="p-3 text-xs text-gray-500">{r.appliedOn}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 text-[10px] rounded-full capitalize ${typeColors[r.type] || "bg-gray-100"}`}>{r.type}</span>
                          </td>
                          <td className="p-3 text-gray-600">{r.startDate === r.endDate ? r.startDate : `${r.startDate} - ${r.endDate}`}</td>
                          <td className="p-3 text-xs text-gray-400 max-w-[150px] truncate">{r.reason || "—"}</td>
                          <td className="p-3 text-xs max-w-[100px] truncate">
                          {r.document ? (
                            <button
                              onClick={() => setDocViewer(r.document)}
                              className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer bg-transparent border-none p-0"
                              title="Click to view document"
                            >📎 View</button>
                          ) : "—"}
                        </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 text-[10px] rounded-full ${statusColors[r.status] || "bg-gray-100"}`}>{r.status}</span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between p-3 border-t border-gray-100">
                <button
                  onClick={() => setHistoryPage(Math.max(0, historyPage - 1))}
                  disabled={historyPage === 0}
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >← Back 15</button>
                <span className="text-xs text-gray-400">Page {Math.floor(historyPage) + 1} of {Math.ceil(empRecords.length / perPage)}</span>
                <button
                  onClick={() => setHistoryPage(Math.min(Math.ceil(empRecords.length / perPage) - 1, historyPage + 1))}
                  disabled={historyPage >= Math.ceil(empRecords.length / perPage) - 1}
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >Next 15 →</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800">Select a Team Member</h3>
        <p className="text-xs text-gray-500 mt-0.5">Choose an employee to view and manage their leave requests</p>
      </div>
      <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
        {[...members].sort((a, b) => {
          const aPending = records.filter((r) => r.employeeId === a.id && r.status === "pending").length;
          const bPending = records.filter((r) => r.employeeId === b.id && r.status === "pending").length;
          return bPending - aPending;
        }).map((m) => {
          const memberRecords = records.filter((r) => r.employeeId === m.id);
          const pendingCount = memberRecords.filter((r) => r.status === "pending").length;
          return (
            <div
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{m.name} <span className="text-xs text-blue-600 font-mono">{m.id}</span></p>
                  <p className="text-xs text-gray-500">{m.designation || "N/A"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {pendingCount > 0 && (
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">{pendingCount} pending</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {members.length === 0 && (
          <p className="p-6 text-sm text-gray-400 text-center">No team members yet</p>
        )}
      </div>
    </div>
  );
}
