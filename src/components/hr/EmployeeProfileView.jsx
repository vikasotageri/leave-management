import { useState } from "react";
import { Button } from "../common/Button";
import { useEmployees } from "../../contexts/EmployeeContext";

export function EmployeeProfileView({ employee, onClose }) {
  if (!employee) return null;
  const { deleteEmployee } = useEmployees();
  const [copied, setCopied] = useState(false);
  const [docViewer, setDocViewer] = useState(null);
  const [docData, setDocData] = useState(employee.document);
  const [page, setPage] = useState(0);
  const [searchId, setSearchId] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const perPage = 10;

  const handleDocUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDocData(reader.result);
    reader.readAsDataURL(file);
  };

  const handleDelete = async () => {
    if (window.confirm(`Delete ${employee.name} (${employee.id}) permanently? This will also remove all their leave records.`)) {
      await deleteEmployee(employee.id);
      if (onClose) onClose();
    }
  };

  const copyPassword = () => {
    navigator.clipboard?.writeText(`Email: ${employee.email}\nPassword: ${employee.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTypeLabel = (t) => ({ sick: "Sick", casual: "Casual", emergency: "Emergency", vacation: "Vacation" }[t] || t);

  const statusColor = (s) => {
    if (s === "auto-approved" || s === "approved") return "bg-green-100 text-green-700";
    if (s === "pending") return "bg-yellow-100 text-yellow-700";
    if (s === "auto-cancelled" || s === "cancelled") return "bg-red-100 text-red-700";
    if (s === "rejected") return "bg-gray-200 text-gray-600";
    return "bg-gray-100 text-gray-700";
  };

  const history = employee.leaveHistory || [];
  const filtered = history.filter((l) => {
    const matchId = !searchId || (l.id && l.id.toLowerCase().includes(searchId.toLowerCase()));
    const matchDate = !searchDate || (l.startDate && l.startDate === searchDate) || (l.endDate && l.endDate === searchDate);
    return matchId && matchDate;
  }).sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice(page * perPage, (page + 1) * perPage);

  return (
    <div className="space-y-6">
      {docViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDocViewer(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-[90vw] h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">Document</h3>
              <button onClick={() => setDocViewer(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none cursor-pointer bg-transparent border-none">&times;</button>
            </div>
            <div className="flex-1 p-4 overflow-auto">
              {docViewer.startsWith("data:application/pdf") ? (
                <iframe src={docViewer} className="w-full h-full rounded-lg" title="Document" />
              ) : docViewer.startsWith("data:image") ? (
                <img src={docViewer} className="max-w-full max-h-full mx-auto rounded-lg" alt="Document" />
              ) : docViewer.startsWith("data:") ? (
                <embed src={docViewer} className="w-full h-full rounded-lg" type="application/octet-stream" />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 flex-col gap-3">
                  <span className="text-4xl">📄</span>
                  <p className="text-sm">File content not stored for this record.</p>
                  <p className="text-xs text-gray-300">Please use <strong>Replace</strong> to upload the document file.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <p className="text-xs text-gray-400">Employee ID</p>
          <p className="font-semibold text-blue-700 font-mono text-lg">{employee.id}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-gray-400">Name</p>
          <p className="font-medium">{employee.name}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Email</p>
          <p className="font-medium">{employee.email}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Phone</p>
          <p className="font-medium">{employee.phone || "-"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Date of Birth</p>
          <p className="font-medium">{employee.dob || "-"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Nationality</p>
          <p className="font-medium">{employee.nationality || "-"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Date of Joining</p>
          <p className="font-medium">{employee.doj || "-"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Designation</p>
          <p className="font-medium">{employee.designation || "-"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Project Tag</p>
          <p className="font-medium">{employee.projectTag || "None"}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-gray-400">Address</p>
          <p className="font-medium">{employee.address || "-"}</p>
        </div>
        {docData && (
          <div className="col-span-2">
            <p className="text-xs text-gray-400">Document</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setDocViewer(docData)} className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1 rounded-md cursor-pointer border-none">View</button>
              <label className="text-xs bg-gray-50 text-gray-500 hover:bg-gray-100 px-2.5 py-1 rounded-md cursor-pointer border-none">Replace<input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleDocUpload} className="hidden" /></label>
            </div>
          </div>
        )}
        {!docData && (
          <div className="col-span-2">
            <p className="text-xs text-gray-400">Document</p>
            <label className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1.5 rounded-md cursor-pointer border-none">+ Upload Document<input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleDocUpload} className="hidden" /></label>
          </div>
        )}
        <div className="col-span-2">
          <p className="text-xs text-gray-400">Password</p>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-yellow-700">{employee.password || "N/A"}</span>
            <button onClick={copyPassword} className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Leave Balance</p>
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-blue-50 p-3 rounded-lg text-center">
            <p className="text-xs text-gray-500">Sick</p>
            <p className="text-lg font-bold text-blue-600">{employee.leaveBalance?.sick?.limit - employee.leaveBalance?.sick?.taken || 0}/{employee.leaveBalance?.sick?.limit || 0}</p>
          </div>
          <div className="bg-green-50 p-3 rounded-lg text-center">
            <p className="text-xs text-gray-500">Casual</p>
            <p className="text-lg font-bold text-green-600">{employee.leaveBalance?.casual?.limit - employee.leaveBalance?.casual?.taken || 0}/{employee.leaveBalance?.casual?.limit || 0}</p>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg text-center">
            <p className="text-xs text-gray-500">Emergency</p>
            <p className="text-lg font-bold text-purple-600">{employee.leaveBalance?.emergency?.limit - employee.leaveBalance?.emergency?.taken || 0}/{employee.leaveBalance?.emergency?.limit || 0}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg text-center">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-lg font-bold text-gray-600">{employee.leaveBalance?.totalAccrued - employee.leaveBalance?.totalTaken || 0}/{employee.leaveBalance?.totalAccrued || 0}</p>
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Leave History</p>
          <span className="text-xs text-gray-400">{filtered.length} total</span>
        </div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <input value={searchId} onChange={(e) => { setSearchId(e.target.value); setPage(0); }} placeholder="Search by Request ID..." className="p-2 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 w-40" />
          <input type="date" value={searchDate} onChange={(e) => { setSearchDate(e.target.value); setPage(0); }} className="p-2 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400">No leave records</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="text-left p-3 font-medium">Request ID</th>
                    <th className="text-left p-3 font-medium">Applied On</th>
                    <th className="text-left p-3 font-medium">Leave Date</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paged.map((l, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="p-3 text-blue-600 font-mono text-xs">{l.id}</td>
                      <td className="p-3 text-xs text-gray-500">{l.appliedOn}</td>
                      <td className="p-3 text-gray-600">{l.startDate === l.endDate ? l.startDate : `${l.startDate} - ${l.endDate}`}</td>
                      <td className="p-3"><span className={`px-2 py-0.5 text-[10px] rounded-full capitalize ${l.type === "sick" ? "bg-red-100 text-red-700" : l.type === "casual" ? "bg-green-100 text-green-700" : l.type === "emergency" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{getTypeLabel(l.type)}</span></td>
                      <td className="p-3"><span className={`px-2 py-0.5 text-[10px] rounded-full ${statusColor(l.status)}`}>{l.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >← Back 10</button>
              <span className="text-xs text-gray-400">Page {page + 1} of {totalPages}</span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >Next 10 →</button>
            </div>
          </>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="danger" className="!text-xs" onClick={handleDelete}>Delete Employee</Button>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}
