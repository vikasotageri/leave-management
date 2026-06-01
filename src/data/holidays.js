const HOLIDAYS_VERSION = "v2";

export const governmentHolidays = [
  { date: "2026-01-01", name: "New Year" },
  { date: "2026-01-26", name: "Republic Day" },
  { date: "2026-03-04", name: "Holi" },
  { date: "2026-04-03", name: "Good Friday" },
  { date: "2026-08-15", name: "Independence Day" },
  { date: "2026-10-02", name: "Gandhi Jayanti" },
  { date: "2026-11-08", name: "Diwali" },
  { date: "2026-12-25", name: "Christmas" },
];

export const getHolidays = () => {
  const stored = localStorage.getItem("holidays");
  const version = localStorage.getItem("holidays_version");
  if (stored && version === HOLIDAYS_VERSION) return JSON.parse(stored);
  localStorage.setItem("holidays", JSON.stringify(governmentHolidays));
  localStorage.setItem("holidays_version", HOLIDAYS_VERSION);
  return governmentHolidays;
};

export const isHoliday = (dateStr) => {
  return governmentHolidays.some((h) => h.date === dateStr);
};

export const getHolidayName = (dateStr) => {
  const h = governmentHolidays.find((h) => h.date === dateStr);
  return h ? h.name : null;
};
