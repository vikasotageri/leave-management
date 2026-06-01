import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { api } from "../services/api";

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [notifKey, setNotifKey] = useState(0);
  const refreshNotifs = useCallback(() => setNotifKey((k) => k + 1), []);

  useEffect(() => {
    const userStr = localStorage.getItem("currentUser");
    if (!userStr) return;
    const user = JSON.parse(userStr);
    api.getNotifications(user.id).then(setNotifications).catch(() => setNotifications([]));
  }, [notifKey]);

  const getAll = useCallback(() => notifications, [notifications]);

  const getUnread = useCallback(() => notifications.filter((n) => !n.read).length, [notifications]);

  const markRead = useCallback(async (id) => {
    await api.markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  return (
    <NotificationContext.Provider value={{ getAll, getUnread, markRead, refreshNotifs, notifKey }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
