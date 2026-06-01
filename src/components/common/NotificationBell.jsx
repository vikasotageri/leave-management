import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../services/api";

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [userNotifications, setUserNotifications] = useState([]);
  const ref = useRef();

  useEffect(() => {
    if (!user) return;
    api.getNotifications(user.id).then(setUserNotifications).catch(() => setUserNotifications([]));
  }, [user, refresh]);

  const unread = userNotifications.filter((n) => !n.read).length;

  const markAllRead = useCallback(() => {
    setUserNotifications((prev) => {
      prev.forEach((n) => { api.markNotificationRead(n.id); });
      return prev.map((n) => ({ ...n, read: true }));
    });
    setRefresh((r) => r + 1);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setRefresh((r) => r + 1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 max-h-96 overflow-y-auto z-50">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Notifications</h3>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
                >Mark all read</button>
              )}
              <span className="text-xs text-gray-400">{userNotifications.length} total</span>
            </div>
          </div>
          {userNotifications.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">No notifications yet</div>
          ) : (
            userNotifications.slice(0, 30).map((n) => (
              <div key={n.id} className="p-3 border-b border-gray-50">
                <div className="flex items-start gap-2">
                  <span className="text-lg">{n.type === "email" ? "📧" : "🔔"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
