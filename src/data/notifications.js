const NOTIF_VERSION = "v4";

export const getNotifications = () => {
  const stored = localStorage.getItem("notifications");
  const version = localStorage.getItem("notifications_version");
  if (stored && version === NOTIF_VERSION) return JSON.parse(stored);
  localStorage.removeItem("notifications");
  localStorage.setItem("notifications_version", NOTIF_VERSION);
  return [];
};

export const saveNotifications = (notifications) => {
  localStorage.setItem("notifications", JSON.stringify(notifications));
};

export const addNotification = (notification) => {
  const notifications = getNotifications();
  const newNotif = {
    id: "N" + Date.now().toString(36).toUpperCase(),
    read: false,
    timestamp: new Date().toISOString(),
    ...notification,
  };
  notifications.unshift(newNotif);
  saveNotifications(notifications);
  return newNotif;
};

export const markNotificationRead = (id) => {
  const notifications = getNotifications();
  const idx = notifications.findIndex((n) => n.id === id);
  if (idx !== -1) {
    notifications[idx].read = true;
    saveNotifications(notifications);
  }
};

export const getUnreadCount = () => {
  return getNotifications().filter((n) => !n.read).length;
};
