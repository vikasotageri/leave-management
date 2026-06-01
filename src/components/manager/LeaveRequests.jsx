import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useLeave } from "../../contexts/LeaveContext";
import { api } from "../../services/api";

const typeColors = {
  sick: "bg-red-100 text-red-700",
  casual: "bg-green-100 text-green-700",
  emergency: "bg-purple-100 text-purple-700",
  vacation: "bg-blue-100 text-blue-700",
};

const statusColors = {
  "auto-approved": "bg-green-100 text-green-700",
  approved: "bg-blue-100 text-blue-700",
  pending: "bg-yellow-100 text-yellow-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-700",
  "cancellation-pending": "bg-orange-100 text-orange-700",
};

export function LeaveRequests() {
  const { user } = useAuth();
  const { getTeamLeaveRequests, refreshKey, approveLeave, rejectLeave, approveCancellation, rejectCancellation } = useLeave();
  const [allLeaves, setAllLeaves] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [docViewer, setDocViewer] = useState(null);

  useEffect(() => {
    if (user) {
      getTeamLeaveRequests(user.id).then(setAllLeaves);
    }
  }, [user, getTeamLeaveRequests, refreshKey]);

  const getEmployeeName = (empId) => empId;

  const filtered = allLeaves.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.employeeId?.toLowerCase().includes(q) ||
      getEmployeeName(l.employeeId)?.toLowerCase().includes(q) ||
      l.type?.toLowerCase().includes(q) ||
      l.status?.toLowerCase().includes(q) ||
      l.startDate?.includes(q) ||
      l.endDate?.includes(q) ||
      l.reason?.toLowerCase().includes(q)
    );
  });

  const selected = allLeaves.find((l) => l.id === selectedId);

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
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800">Leave Requests</h3>
        <p className="text-xs text-gray-500 mt-0.5">{allLeaves.length} total request(s)</p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by employee ID, name, type, status, date..."
          className="mt-3 w-full p-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2">
        <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto border-r border-gray-100">
          {filtered.length === 0 ? (
            <p className="p-6 text-sm text-gray-400 text-center">No leave requests found</p>
          ) : (
            filtered
              .sort((a, b) => new Date(b.appliedOn) - new Date(a.appliedOn))
              .map((l) => (
                <label
                  key={l.id}
                  className={`flex items-start gap-3 p-3 cursor-pointer transition-colors hover:bg-gray-50 ${selectedId === l.id ? "bg-blue-50" : ""}`}
                >
                  <input
                    type="radio"
                    name="leaveSelect"
                    checked={selectedId === l.id}
                    onChange={() => setSelectedId(l.id)}
                    className="mt-1 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{getEmployeeName(l.employeeId)}</span>
                      <span className={`px-1.5 py-0.5 text-[10px] rounded-full capitalize ${typeColors[l.type] || "bg-gray-100"}`}>{l.type}</span>
                      <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${statusColors[l.status] || "bg-gray-100"}`}>{l.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{l.startDate} → {l.endDate}</p>
                    <p className="text-[11px] text-gray-400 truncate">{l.reason || "No reason"}</p>
                  </div>
                </label>
              ))
          )}
        </div>

        <div className="p-4 max-h-[400px] overflow-y-auto">
          {!selected ? (
            <p className="text-sm text-gray-400 text-center py-8">Select a request to view details</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-800">{getEmployeeName(selected.employeeId)}</h4>
                <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[selected.status] || "bg-gray-100"}`}>
                  {selected.status}
                </span>
              </div>

              {(() => {
                const emp = team.find((t) => t.id === selected.employeeId);
                return emp ? (
                  <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-3 border border-gray-200 text-xs">
                    <p className="font-semibold text-gray-700 mb-1">👤 Employee Details</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600">
                      <span>ID: <strong className="text-blue-700">{emp.id}</strong></span>
                      <span>DOJ: <strong>{emp.doj || "—"}</strong></span>
                      <span>DOB: <strong>{emp.dob || "—"}</strong></span>
                      <span>Phone: <strong>{emp.phone || "—"}</strong></span>
                      <span>Email: <strong className="truncate">{emp.email}</strong></span>
                      {emp.projectTag && <span>Project: <strong>{emp.projectTag}</strong></span>}
                    </div>
                  </div>
                ) : null;
              })()}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Employee ID</p>
                  <p className="font-mono text-blue-700">{selected.employeeId}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Leave Type</p>
                  <p className="capitalize font-medium">{selected.type}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Start Date</p>
                  <p className="font-medium">{selected.startDate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">End Date</p>
                  <p className="font-medium">{selected.endDate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Applied On</p>
                  <p>{selected.appliedOn}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Approved By</p>
                  <p>{selected.approvedBy || "—"}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-1">Reason</p>
                <p className="text-sm bg-gray-50 p-2 rounded-lg">{selected.reason || "No reason provided"}</p>
              </div>

              {selected.document && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">📎 Attached Document</p>
                  <button
                    onClick={() => setDocViewer(selected.document)}
                    className="inline-flex items-center gap-1 text-sm text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 cursor-pointer border-none"
                  >View Document ↗</button>
                </div>
              )}

              {selected.status === "pending" && (
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={async () => { await approveLeave(selected.id); setSelectedId(null); }}
                    className="flex-1 px-3 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 cursor-pointer"
                  >Approve</button>
                  <button
                    onClick={async () => {
                      const reason = prompt("Rejection reason:");
                      if (reason) { await rejectLeave(selected.id, reason); setSelectedId(null); }
                    }}
                    className="flex-1 px-3 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 cursor-pointer"
                  >Reject</button>
                </div>
              )}

              {selected.status === "cancellation-pending" && (
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={async () => { await approveCancellation(selected.id); setSelectedId(null); }}
                    className="flex-1 px-3 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 cursor-pointer"
                  >Approve Cancellation</button>
                  <button
                    onClick={async () => { await rejectCancellation(selected.id); setSelectedId(null); }}
                    className="flex-1 px-3 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 cursor-pointer"
                  >Reject Cancellation</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
