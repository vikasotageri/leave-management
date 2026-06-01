import { useState } from "react";
import { TeamMemberList } from "../components/manager/TeamMemberList";
import { TeamApprovalList } from "../components/manager/TeamApprovalList";
import { ChatInterface } from "../components/ai/ChatInterface";

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "leaves", label: "Team Leave Approve Request", icon: "✅" },
  { id: "chat", label: "AI Chat", icon: "🤖" },
];

export function ManagerDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Manager Dashboard</h1>
        <p className="text-gray-500">Manage your team's leaves and approvals</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === t.id
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {activeTab === "dashboard" && <TeamMemberList />}

      {activeTab === "leaves" && <TeamApprovalList />}

      {activeTab === "chat" && <ChatInterface />}
    </div>
  );
}
