import { useState } from "react";
import { useLeave } from "../../contexts/LeaveContext";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../common/Button";

export function ApplyLeaveForm() {
  const { user } = useAuth();
  const { applyLeave } = useLeave();
  const [type, setType] = useState("sick");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [document, setDocument] = useState(null);
  const [docName, setDocName] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + 2);
  const maxDateStr = maxDate.toISOString().split("T")[0];
  const minDateStr = new Date().toISOString().split("T")[0];

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setDocName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setDocument(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const res = await applyLeave(user.id, type, startDate, endDate, reason, document);
    setResult(res);
    if (res.success) {
      setStartDate("");
      setEndDate("");
      setReason("");
      setDocument(null);
      setDocName("");
    }
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-xl">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Apply for Leave</h3>

      {result && (
        <div className={`p-4 rounded-lg mb-4 ${result.success ? (result.status === "auto-approved" ? "bg-green-50 border border-green-200" : "bg-yellow-50 border border-yellow-200") : "bg-red-50 border border-red-200"}`}>
          {result.success ? (
            result.status === "auto-approved" ? (
              <p className="text-green-700 font-medium">✅ Auto-approved! Your manager has been notified.</p>
            ) : (
              <p className="text-yellow-700 font-medium">📨 Submitted to your manager for approval.</p>
            )
          ) : (
            <p className="text-red-700 font-medium">❌ {result.error}</p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
            <option value="sick">Sick Leave</option>
            <option value="casual">Casual Leave</option>
            <option value="emergency">Emergency / Personal / Family</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input type="date" value={startDate} min={minDateStr} max={maxDateStr} onChange={(e) => setStartDate(e.target.value)} required className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input type="date" value={endDate} min={startDate || minDateStr} max={maxDateStr} onChange={(e) => setEndDate(e.target.value)} required className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} required rows={3} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none" placeholder="Enter reason for leave..." />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Document (optional)</label>
          <input type="file" onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
          {docName && <p className="text-xs text-green-600 mt-1">📎 {docName}</p>}
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Submitting..." : "Apply for Leave"}
        </Button>
      </form>
    </div>
  );
}
