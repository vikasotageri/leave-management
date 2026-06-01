import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { NotificationBell } from "./NotificationBell";

export function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!user) return null;

  const role = user.role;
  const links = {
    hr: [
      { to: "/hr/dashboard", label: "Dashboard" },
    ],
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-xl font-bold text-blue-700">
            LeaveFlow
          </Link>
          <div className="flex gap-1">
            {(links[role] || []).map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === link.to
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <NotificationBell />
          <span className="text-xs text-gray-400 font-mono tabular-nums">
            {clock.toLocaleDateString()} {clock.toLocaleTimeString()}
          </span>
          <span className="text-sm text-gray-600">
            {user.name} <span className="text-gray-400">({role})</span>
          </span>
          <button
            onClick={logout}
            className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
