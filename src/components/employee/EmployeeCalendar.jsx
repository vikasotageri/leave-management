import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useLeave } from "../../contexts/LeaveContext";
import { getHolidays, governmentHolidays } from "../../data/holidays";

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const statusColors = {
  "auto-approved": "bg-green-500 text-white",
  approved: "bg-green-500 text-white",
  pending: "bg-orange-400 text-white",
  rejected: "bg-gray-200 text-gray-500",
  cancelled: "bg-gray-200 text-gray-500",
  "auto-cancelled": "bg-gray-200 text-gray-500",
  "cancellation-pending": "bg-yellow-400 text-white",
};

export function EmployeeCalendar({ isOpen, onClose }) {
  const { user } = useAuth();
  const { getHistory, refreshKey } = useLeave();
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [leaves, setLeaves] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    if (user && isOpen) {
      getHistory(user.id, 50).then(setLeaves);
      setHolidays(getHolidays());
      setSelectedDay(null);
    }
  }, [user, getHistory, isOpen, refreshKey]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();

  const getLeavesForDay = (day) => {
    const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return leaves.filter((l) => ds >= l.startDate && ds <= l.endDate);
  };

  const isHoliday = (day) => {
    const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return holidays.find((h) => h.date === ds);
  };

  const isWeekend = (day) => {
    const d = new Date(viewYear, viewMonth, day);
    return d.getDay() === 0 || d.getDay() === 6;
  };

  const dayLeaves = selectedDay ? getLeavesForDay(selectedDay) : [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-3xl max-h-[90vh] overflow-y-auto mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">📅 Calendar & Holidays</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none cursor-pointer">&times;</button>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); } else setViewMonth(viewMonth - 1); }}
              className="px-3 py-1 text-sm border rounded-lg hover:bg-gray-50 cursor-pointer"
            >&larr; Prev</button>
            <h3 className="font-semibold text-gray-800">{months[viewMonth]} {viewYear}</h3>
            <button
              onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); } else setViewMonth(viewMonth + 1); }}
              className="px-3 py-1 text-sm border rounded-lg hover:bg-gray-50 cursor-pointer"
            >Next &rarr;</button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-gray-500 py-1">{d}</div>
            ))}
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const h = isHoliday(day);
              const w = isWeekend(day);
              const dl = getLeavesForDay(day);
              const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isToday = ds === today.toISOString().split("T")[0];

              let bg = "";
              if (h) bg = "bg-purple-100";
              else if (w) bg = "bg-gray-100";
              if (dl.length > 0) {
                const status = dl[0].status;
                if (status === "auto-approved" || status === "approved") bg = "bg-green-100";
                else if (status === "pending") bg = "bg-orange-100";
              }

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDay(selectedDay === day ? null : day)}
                  className={`min-h-[44px] p-1 rounded-lg border cursor-pointer transition-colors ${bg} ${isToday ? "border-blue-500 border-2" : "border-gray-100"} hover:shadow-sm`}
                >
                  <span className={`text-xs font-medium ${h ? "text-purple-700" : w ? "text-gray-400" : "text-gray-700"}`}>
                    {day}
                  </span>
                  {h && <div className="text-[7px] text-purple-600 truncate leading-tight">{h.name}</div>}
                  {dl.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-0.5">
                      {dl.slice(0, 2).map((l) => (
                        <div key={l.id} className={`w-1.5 h-1.5 rounded-full ${statusColors[l.status]?.split(" ")[0] || "bg-gray-300"}`} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {selectedDay && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-2">
                {selectedDay} {months[viewMonth]} {viewYear}
                {(() => {
                  const h = isHoliday(selectedDay);
                  const w = isWeekend(selectedDay);
                  if (h) return <span className="text-purple-600 font-normal ml-1">🎉 {h.name}</span>;
                  if (w) return <span className="text-gray-400 font-normal ml-1">(Weekend)</span>;
                  return "";
                })()}
              </p>
              {dayLeaves.length === 0 ? (
                <p className="text-xs text-gray-400">No leaves on this day</p>
              ) : (
                dayLeaves.map((l) => (
                  <div key={l.id} className="flex items-center justify-between text-xs bg-white p-2 rounded border border-gray-100 mb-1">
                    <span className="capitalize font-medium">{l.type}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${statusColors[l.status] || "bg-gray-100"}`}>{l.status}</span>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-100 inline-block" /> Govt Holiday</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 inline-block" /> Weekend</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 inline-block" /> Approved</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-100 inline-block" /> Pending</span>
          </div>
        </div>

        <div className="p-5 pt-0">
          <div className="border-t border-gray-200 pt-5">
            <h3 className="text-lg font-bold text-gray-800 mb-4">🎉 Public Holidays – 2026</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {governmentHolidays
                .filter((h) => h.date.startsWith("2026"))
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((h) => {
                  const [y, m, d] = h.date.split("-").map(Number);
                  return (
                    <div key={h.date} className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl border border-purple-200">
                      <div className="text-center">
                        <div className="text-lg font-bold text-purple-700">{d}</div>
                        <div className="text-[10px] font-medium text-purple-500">{months[m - 1].slice(0, 3)}</div>
                      </div>
                      <div className="text-sm font-semibold text-gray-800">{h.name}</div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
