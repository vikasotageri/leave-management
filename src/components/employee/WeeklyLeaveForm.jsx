import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useLeave } from "../../contexts/LeaveContext";
import { getHolidays } from "../../data/holidays";
import { Button } from "../common/Button";

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getWeekRange(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const leaveTypes = [
  { value: "sick", label: "Sick" },
  { value: "casual", label: "Casual" },
  { value: "business", label: "Business" },
  { value: "emergency", label: "Emergency/Personal" },
];

export function WeeklyLeaveForm({ showHistory = true }) {
  const { user } = useAuth();
  const { applyLeave, getHistory, cancelLeave, refreshKey } = useLeave();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const initialWeek = getWeekRange(today);
  const [weekStart, setWeekStart] = useState(new Date(initialWeek.monday));
  const [selectedDays, setSelectedDays] = useState({});
  const [reason, setReason] = useState("");
  const [document, setDocument] = useState(null);
  const [docName, setDocName] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [leaves, setLeaves] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyPage, setHistoryPage] = useState(0);

  useEffect(() => {
    if (user) {
      getHistory(user.id, 200).then(setLeaves);
      setHolidays(getHolidays());
    }
  }, [user, getHistory, refreshKey]);

  const weekDays = useMemo(() => {
    const days = [];
    const d = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      const date = new Date(d);
      days.push({
        date,
        dateStr: toDateStr(date),
        dayName: dayNames[i],
        dayNum: date.getDate(),
        month: date.getMonth(),
        year: date.getFullYear(),
      });
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [weekStart]);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };

  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  const handleDropdownChange = (dateStr, value) => {
    setSelectedDays((prev) => {
      const next = { ...prev };
      if (value === "") {
        delete next[dateStr];
      } else {
        next[dateStr] = value;
      }
      return next;
    });
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setDocName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => setDocument(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    const entries = Object.entries(selectedDays);
    if (entries.length === 0) return;
    setLoading(true);
    setResult(null);
    let successCount = 0;
    let lastResult = null;
    for (const [dateStr, type] of entries) {
      const res = await applyLeave(user.id, type, dateStr, dateStr, reason, document);
      lastResult = res;
      if (res.success) successCount++;
    }
    if (successCount === entries.length) {
      setResult({ success: true, status: lastResult?.status || "pending" });
      setReason("");
      setDocument(null);
      setDocName("");
      setSelectedDays({});
      setLeaves(getHistory(user.id, 200));
    } else {
      setResult(lastResult || { success: false, error: "Failed" });
    }
    setLoading(false);
  };

  const isDayDisabled = (day) => {
    if (day.date.getDay() === 0 || day.date.getDay() === 6) return true;
    const h = holidays.find((h) => h.date === day.dateStr);
    if (h) return true;
    const dayLeaves = leaves.filter((l) => day.dateStr >= l.startDate && day.dateStr <= l.endDate);
    if (dayLeaves.length > 0 && (dayLeaves[0].status === "auto-approved" || dayLeaves[0].status === "approved" || dayLeaves[0].status === "pending" || dayLeaves[0].status === "cancellation-pending")) return true;
    return false;
  };

  const getHolidayName = (day) => {
    const h = holidays.find((h) => h.date === day.dateStr);
    return h ? h.name : null;
  };

  const getDayBg = (day) => {
    if (day.date.getDay() === 0 || day.date.getDay() === 6) return "bg-gray-50 border-gray-200";
    if (getHolidayName(day)) return "bg-purple-50 border-purple-200";
    const dayLeaves = leaves.filter((l) => day.dateStr >= l.startDate && day.dateStr <= l.endDate);
    if (dayLeaves.length > 0) {
      const s = dayLeaves[0].status;
      if (s === "auto-approved" || s === "approved") return "bg-green-50 border-green-200";
      if (s === "pending") return "bg-orange-50 border-orange-200";
    }
    return "bg-white border-gray-200";
  };

  const selectedCount = Object.keys(selectedDays).length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">📅 Apply Leave – Weekly View</h3>

      <div className="flex items-center justify-between mb-5">
        <button onClick={prevWeek} className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer shadow-sm">&larr; Prev Week</button>
        <p className="text-sm font-bold text-gray-700">
          Week of {weekStart.getDate()} {months[weekStart.getMonth()]} {weekStart.getFullYear()} — {weekEnd.getDate()} {months[weekEnd.getMonth()]} {weekEnd.getFullYear()}
        </p>
        <button onClick={nextWeek} className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer shadow-sm">Next Week &rarr;</button>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-5">
        {weekDays.map((day) => {
          const disabled = isDayDisabled(day);
          const selType = selectedDays[day.dateStr] || "";
          const hasSelection = !!selectedDays[day.dateStr];
          const hName = getHolidayName(day);

          return (
            <div key={day.dateStr} className={`min-h-[130px] p-2.5 rounded-xl border-2 ${getDayBg(day)} ${disabled ? "opacity-50" : "hover:border-blue-300"} transition`}>
              <div className="text-center mb-1">
                <div className="text-[10px] font-semibold text-gray-500 uppercase">{day.dayName}</div>
                <div className="text-lg font-bold text-gray-800">{day.dayNum}</div>
                <div className="text-[9px] text-gray-400">{months[day.month].slice(0, 3)}</div>
              </div>
              {hName && <div className="text-[8px] text-purple-600 font-medium text-center leading-tight">{hName}</div>}
              {!disabled && (
                <div className="flex flex-col items-center gap-1.5 mt-1">
                  <select
                    value={selType}
                    onChange={(e) => handleDropdownChange(day.dateStr, e.target.value)}
                    className={`w-full text-[10px] p-1 rounded border outline-none cursor-pointer ${hasSelection ? "bg-blue-50 border-blue-400 text-gray-800 font-semibold" : "bg-white border-gray-300 text-gray-500"}`}
                  >
                    <option value="">☐ Select</option>
                    {leaveTypes.map((lt) => (
                      <option key={lt.value} value={lt.value}>{lt.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 mb-4 text-[11px] text-gray-500 font-medium">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-50 border border-green-200" /> Approved</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-50 border border-orange-200" /> Pending</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-50 border border-purple-200" /> Holiday</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-50 border border-gray-200" /> Weekend</span>
      </div>

      {selectedCount > 0 && (
        <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 mb-4">
          <p className="text-sm font-semibold text-blue-800">
            ✅ {selectedCount} day{selectedCount !== 1 ? "s" : ""} selected
          </p>
          <div className="text-xs text-blue-600 mt-1 space-y-0.5">
            {Object.entries(selectedDays).map(([ds, type]) => {
              const d = new Date(ds + "T00:00:00");
              const label = leaveTypes.find((lt) => lt.value === type)?.label || type;
              return <div key={ds}>{d.getDate()} {months[d.getMonth()]} — <span className="capitalize font-semibold">{label}</span></div>;
            })}
            <button onClick={() => setSelectedDays({})} className="text-red-500 underline mt-1 inline-block cursor-pointer">Clear all</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for leave..." rows={2} className="w-full p-3 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 resize-none" />

        <div>
          <input type="file" onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
          {docName && <p className="text-xs text-green-600 mt-1">📎 {docName}</p>}
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSubmit} disabled={loading || selectedCount === 0} className="px-6 py-2.5 text-sm font-bold shadow-md">
            {loading ? "Submitting..." : `Apply Leave (${selectedCount} day${selectedCount !== 1 ? "s" : ""})`}
          </Button>
        </div>
      </div>

      {result && (
        <div className={`mt-4 p-3 rounded-xl text-sm font-medium ${result.success ? (result.status === "auto-approved" ? "bg-green-50 text-green-800 border border-green-200" : "bg-yellow-50 text-yellow-800 border border-yellow-200") : "bg-red-50 text-red-800 border border-red-200"}`}>
          {result.success
            ? (result.status === "auto-approved" ? "✅ Auto-approved!" : "📨 Sent to manager for approval.")
            : `❌ ${result.error}`}
        </div>
      )}

      {showHistory && <HistorySection historySearch={historySearch} setHistorySearch={setHistorySearch} historyPage={historyPage} setHistoryPage={setHistoryPage} leaves={leaves} cancelLeave={cancelLeave} />}
    </div>
  );
}

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

function HistorySection({ historySearch, setHistorySearch, historyPage, setHistoryPage, leaves, cancelLeave }) {
  const [showCancel, setShowCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState("");

  const filtered = leaves
    .filter((l) => {
      if (!historySearch.trim()) return true;
      const q = historySearch.toLowerCase();
      return l.id.toLowerCase().includes(q) || l.startDate.includes(q);
    })
    .sort((a, b) => b.appliedOn.localeCompare(a.appliedOn));

  const perPage = 20;
  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const safePage = Math.min(historyPage, Math.max(0, totalPages - 1));
  if (safePage !== historyPage) setHistoryPage(safePage);
  const pageLeaves = filtered.slice(safePage * perPage, safePage * perPage + perPage);

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
      setShowCancel(null);
      return;
    }
    if (!cancelReason.trim()) return;
    await cancelLeave(leaveId, cancelReason);
    setShowCancel(null);
    setCancelReason("");
  };

  return (
    <div className="mt-6 border-t border-gray-200 pt-5">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">📋 Applied Leave History</h4>
      <input type="text" value={historySearch} onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(0); }} placeholder="Search by Request ID or date..." className="w-full max-w-sm px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-400 mb-3" />
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
          <button disabled={safePage === 0} onClick={() => setHistoryPage(safePage - 1)} className="px-3 py-1 text-[11px] font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">&larr; Previous 20</button>
          <button disabled={safePage >= totalPages - 1} onClick={() => setHistoryPage(safePage + 1)} className="px-3 py-1 text-[11px] font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">Next 20 &rarr;</button>
        </div>
      </div>
    </div>
  );
}
