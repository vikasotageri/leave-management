import { useState, useEffect } from "react";
import { useLeave } from "../../contexts/LeaveContext";
import { useAuth } from "../../contexts/AuthContext";

export function LeaveBalance() {
  const { user } = useAuth();
  const { getBalance, refreshKey } = useLeave();
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    if (user) getBalance(user.id).then(setBalance);
  }, [user, getBalance, refreshKey]);

  if (!balance) return null;

  const cards = [
    { label: "Sick Leave", remaining: balance.sick?.remaining ?? 0, limit: balance.sick?.limit ?? 0, color: "blue" },
    { label: "Casual Leave", remaining: balance.casual?.remaining ?? 0, limit: balance.casual?.limit ?? 0, color: "green" },
    { label: "Business Leave", remaining: balance.business?.remaining ?? 0, limit: balance.business?.limit ?? 0, color: "indigo" },
    { label: "Emergency Leave", remaining: balance.emergency?.remaining ?? 0, limit: balance.emergency?.monthlyLimit ?? 0, sub: `Year: ${balance.emergency?.usedThisYear ?? 0}/${balance.emergency?.yearlyLimit ?? 0}`, color: "purple" },
    { label: "Total Days", remaining: balance.total?.remaining ?? 0, limit: balance.total?.accrued ?? 0, sub: `${balance.total?.taken ?? 0} used`, color: "gray" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <div key={card.label} className={`bg-white rounded-xl shadow-sm border border-${card.color}-200 p-5`}>
          <p className="text-sm text-gray-500">{card.label}</p>
          <p className={`text-3xl font-bold text-${card.color}-600 mt-1`}>
            {card.remaining}
            <span className="text-lg text-gray-400 font-normal">/{card.limit}</span>
          </p>
          {card.sub && <p className="text-xs text-gray-400 mt-1">{card.sub}</p>}
        </div>
      ))}
    </div>
  );
}
