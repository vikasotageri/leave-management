import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { LeaveBalance } from "../components/employee/LeaveBalance";
import { UpcomingLeaves } from "../components/employee/UpcomingLeaves";
import { WeeklyLeaveForm } from "../components/employee/WeeklyLeaveForm";
import { LeaveHistoryView } from "../components/employee/LeaveHistoryView";
import { EmployeeCalendar } from "../components/employee/EmployeeCalendar";
import { EmployeeChatBot } from "../components/employee/EmployeeChatBot";

export function EmployeeDashboard() {
  const { user } = useAuth();
  const [showCalendar, setShowCalendar] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm">Welcome back,</p>
            <h1 className="text-2xl font-bold">{user?.name}</h1>
            <div className="flex gap-4 mt-2 text-sm text-blue-100">
              <span>🆔 {user?.id}</span>
              <span>📅 Joined: {user?.doj || "N/A"}</span>
              <span>📧 {user?.email}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowCalendar(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-blue-700 hover:bg-blue-50 rounded-xl text-sm font-bold shadow-md cursor-pointer transition"
            >📅 Calendar & Holidays</button>
            <div className="text-right">
              <p className="text-3xl font-bold">{user?.leaveBalance?.totalAccrued || 0}</p>
              <p className="text-blue-100 text-sm">Total Days Accrued</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`px-5 py-2 text-sm font-semibold rounded-t-lg cursor-pointer transition ${activeTab === "dashboard" ? "bg-white text-blue-700 border border-b-0 border-gray-200 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >📊 Dashboard</button>
        <button
          onClick={() => setActiveTab("apply-leave")}
          className={`px-5 py-2 text-sm font-semibold rounded-t-lg cursor-pointer transition ${activeTab === "apply-leave" ? "bg-white text-blue-700 border border-b-0 border-gray-200 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >📝 Apply Leave</button>
      </div>

      {activeTab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <LeaveBalance />
            </div>
            <div>
              <UpcomingLeaves />
            </div>
          </div>
          <WeeklyLeaveForm showHistory={false} />
        </div>
      )}

      {activeTab === "apply-leave" && <LeaveHistoryView />}

      <EmployeeCalendar isOpen={showCalendar} onClose={() => setShowCalendar(false)} />
      <EmployeeChatBot />
    </div>
  );
}
