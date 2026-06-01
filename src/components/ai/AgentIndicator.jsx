export function AgentIndicator({ agent }) {
  const agents = {
    employee: { label: "Employee Agent", emoji: "👤", color: "blue" },
    manager: { label: "Manager Agent", emoji: "👔", color: "green" },
    policy: { label: "Policy Agent", emoji: "📋", color: "purple" },
    scheduling: { label: "Scheduling Agent", emoji: "📅", color: "orange" },
    cancellation: { label: "Cancellation Agent", emoji: "↩️", color: "red" },
  };

  const info = agents[agent] || { label: "Assistant", emoji: "🤖", color: "gray" };

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
      <span className="animate-pulse">{info.emoji}</span>
      <span className="font-medium">{info.label}</span>
      <span className="text-gray-300">is responding...</span>
    </div>
  );
}
