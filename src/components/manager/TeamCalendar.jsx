import { useState, useEffect } from "react";
import { useLeave } from "../../contexts/LeaveContext";
import { useAuth } from "../../contexts/AuthContext";

export function TeamCalendar() {
  const { user } = useAuth();
  const { getTeamLeaves, refreshKey } = useLeave();
  const [leaves, setLeaves] = useState([]);

  useEffect(() => {
    if (user) getTeamLeaves(user.id).then(setLeaves);
  }, [user, getTeamLeaves, refreshKey]);

  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();

  const monthLeaves = leaves.filter((l) => {
    const d = new Date(l.startDate);
    return d.getMonth() === viewMonth && d.getFullYear() === viewYear;
  });

  const getLeavesForDay = (day) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return monthLeaves.filter((l) => {
      const start = l.startDate;
      const end = l.endDate;
      return dateStr >= start && dateStr <= end;
    });
  };

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const typeColors = {
    sick: "bg-red-200 text-red-800",
    casual: "bg-green-200 text-green-800",
    emergency: "bg-purple-200 text-purple-800",
    vacation: "bg-blue-200 text-blue-800",
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); } else setViewMonth(viewMonth - 1); }} className="px-3 py-1 text-sm border rounded-lg hover:bg-gray-50 cursor-pointer">&larr; Prev</button>
        <h3 className="font-semibold text-gray-800">{months[viewMonth]} {viewYear}</h3>
        <button onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); } else setViewMonth(viewMonth + 1); }} className="px-3 py-1 text-sm border rounded-lg hover:bg-gray-50 cursor-pointer">Next &rarr;</button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[60px]" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayLeaves = getLeavesForDay(day);
          const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
          return (
            <div key={day} className={`min-h-[60px] p-1 rounded-lg border ${isToday ? "border-blue-400 bg-blue-50" : "border-gray-100"}`}>
              <span className={`text-xs font-medium ${isToday ? "text-blue-600" : "text-gray-600"}`}>{day}</span>
              <div className="mt-0.5 space-y-0.5">
                {dayLeaves.slice(0, 2).map((l) => (
                  <div key={l.id} className={`text-[10px] px-1 rounded truncate ${typeColors[l.type] || "bg-gray-100 text-gray-700"}`}>
                    {l.employeeName?.split(" ")[0]}
                  </div>
                ))}
                {dayLeaves.length > 2 && <div className="text-[10px] text-gray-400">+{dayLeaves.length - 2} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
