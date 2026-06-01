export function Badge({ status }) {
  const colors = {
    "auto-approved": "bg-green-100 text-green-800 border-green-300",
    approved: "bg-blue-100 text-blue-800 border-blue-300",
    pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
    rejected: "bg-red-100 text-red-800 border-red-300",
    "cancellation-pending": "bg-purple-100 text-purple-800 border-purple-300",
    cancelled: "bg-gray-100 text-gray-800 border-gray-300",
    "auto-cancelled": "bg-gray-100 text-gray-800 border-gray-300",
  };
  const labels = {
    "auto-approved": "Auto-Approved",
    approved: "Approved",
    pending: "Pending",
    rejected: "Rejected",
    "cancellation-pending": "Cancellation Pending",
    cancelled: "Cancelled",
    "auto-cancelled": "Auto-Cancelled",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${colors[status] || colors.pending}`}>
      {labels[status] || status}
    </span>
  );
}
