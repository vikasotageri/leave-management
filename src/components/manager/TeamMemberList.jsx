import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useLeave } from "../../contexts/LeaveContext";
import { useEmployees } from "../../contexts/EmployeeContext";
import { api } from "../../services/api";
import { Button } from "../common/Button";

export function TeamMemberList() {
  const { user } = useAuth();
  const { setProjectTag } = useEmployees();
  const { getTeamLeaves, refreshKey } = useLeave();
  const [members, setMembers] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (user) {
      getTeamLeaves(user.id).then(setLeaves);
      api.getEmployees().then((emps) => setMembers(emps));
    }
  }, [user, getTeamLeaves, refreshKey]);

  const memberLeaves = (empId) => leaves.filter((l) => l.employeeId === empId);

  const emp = selected ? members.find((m) => m.id === selected) : null;

  const handleTag = async () => {
    if (!selected || !tagInput.trim()) return;
    const res = await setProjectTag(selected, tagInput.trim());
    if (res.success) {
      setMembers((prev) => prev.map((m) => (m.id === selected ? { ...m, projectTag: res.employee.projectTag } : m)));
      setTagInput("");
    }
  };

  const handleUntag = async () => {
    if (!selected) return;
    const res = await setProjectTag(selected, null);
    if (res.success) {
      setMembers((prev) => prev.map((m) => (m.id === selected ? { ...m, projectTag: null } : m)));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Team Members</h3>
          <p className="text-xs text-gray-500 mt-0.5">{members.length} member(s) in your team</p>
        </div>
        <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
          {members.map((m) => {
            const ml = memberLeaves(m.id);
            const activeLeaves = ml.filter((l) => l.status === "approved" || l.status === "auto-approved");
            const pendingCount = ml.filter((l) => l.status === "pending").length;
            return (
              <div
                key={m.id}
                onClick={() => { setSelected(selected === m.id ? null : m.id); setTagInput(""); }}
                className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${selected === m.id ? "bg-blue-50 border-l-4 border-l-blue-500" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{m.name} <span className="text-xs text-blue-600 font-mono">{m.id}</span></p>
                    <p className="text-xs text-gray-500">{m.email} &middot; {m.designation || "N/A"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.projectTag && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">{m.projectTag}</span>
                    )}
                    {pendingCount > 0 && (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">{pendingCount} pending</span>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex gap-2 text-xs text-gray-500">
                  <span>🏖️ {m.leaveBalance?.totalAccrued || 0} accrued</span>
                  <span>📊 {m.leaveBalance?.totalTaken || 0} taken</span>
                  <span>✅ {activeLeaves.length} active</span>
                </div>
              </div>
            );
          })}
          {members.length === 0 && (
            <p className="p-6 text-sm text-gray-400 text-center">No team members yet</p>
          )}
        </div>
      </div>

      {selected && emp && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Employee Details</h3>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl cursor-pointer">&times;</button>
          </div>
          <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                {emp.name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-gray-800">{emp.name}</p>
                <p className="text-xs text-blue-600 font-mono">{emp.id}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">Email</p>
                <p className="font-medium">{emp.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Phone</p>
                <p className="font-medium">{emp.phone || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Date of Birth</p>
                <p className="font-medium">{emp.dob || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Nationality</p>
                <p className="font-medium">{emp.nationality || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Date of Joining</p>
                <p className="font-medium">{emp.doj || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Designation</p>
                <p className="font-medium">{emp.designation || "-"}</p>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-400 mb-2">Project Tag</p>
              {emp.projectTag ? (
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm rounded-lg font-medium">{emp.projectTag}</span>
                  <Button variant="danger" className="text-xs !px-3 !py-1.5" onClick={handleUntag}>Untag</Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Enter project name"
                    className="flex-1 p-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => { if (e.key === "Enter") handleTag(); }}
                  />
                  <Button variant="outline" className="text-xs !px-4" onClick={handleTag} disabled={!tagInput.trim()}>Tag</Button>
                </div>
              )}
              {emp.projectTag && (
                <p className="text-[11px] text-gray-400 mt-2">Tagged employees cannot auto-approve leaves. All leaves require manager approval.</p>
              )}
            </div>

            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-400 mb-2">Leave Balance</p>
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-blue-50 p-2 rounded-lg text-center">
                  <p className="text-[10px] text-gray-500">Sick</p>
                  <p className="text-sm font-bold text-blue-600">{emp.leaveBalance.sick.limit - emp.leaveBalance.sick.taken}/{emp.leaveBalance.sick.limit}</p>
                </div>
                <div className="bg-green-50 p-2 rounded-lg text-center">
                  <p className="text-[10px] text-gray-500">Casual</p>
                  <p className="text-sm font-bold text-green-600">{emp.leaveBalance.casual.limit - emp.leaveBalance.casual.taken}/{emp.leaveBalance.casual.limit}</p>
                </div>
                <div className="bg-purple-50 p-2 rounded-lg text-center">
                  <p className="text-[10px] text-gray-500">Emergency</p>
                  <p className="text-sm font-bold text-purple-600">{emp.leaveBalance.emergency.limit - emp.leaveBalance.emergency.taken}/{emp.leaveBalance.emergency.limit}</p>
                </div>
                <div className="bg-gray-50 p-2 rounded-lg text-center">
                  <p className="text-[10px] text-gray-500">Total</p>
                  <p className="text-sm font-bold text-gray-600">{emp.leaveBalance.totalAccrued - emp.leaveBalance.totalTaken}/{emp.leaveBalance.totalAccrued}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
