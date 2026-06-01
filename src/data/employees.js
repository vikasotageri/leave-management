const employees = [
  {
    id: "HR001",
    name: "HR Manager",
    email: "hr@company.com",
    password: "pass123",
    role: "hr",
    phone: "9876543200",
    dob: "1990-01-01",
    doj: "2023-01-01",
    address: "Corporate Office, Bangalore",
    projectTag: null,
    managerId: null,
    resume: "HR professional with 8 years experience.",
    leaveBalance: {
      sick: { taken: 0, limit: 2 },
      casual: { taken: 0, limit: 1 },
      business: { taken: 0, limit: 10 },
      emergency: { taken: 0, limit: 4 },
      totalAccrued: 20,
      totalTaken: 0,
    },
  },
  {
    id: "MGR001",
    name: "Mike Johnson",
    email: "manager@company.com",
    password: "pass123",
    role: "manager",
    phone: "9876543222",
    dob: "1988-07-14",
    doj: "2022-06-01",
    address: "Tech Park, Bangalore",
    projectTag: null,
    managerId: null,
    resume: "Engineering manager with 10 years of experience leading teams.",
    teamIds: [],
    leaveBalance: {
      sick: { taken: 0, limit: 2 },
      casual: { taken: 0, limit: 1 },
      business: { taken: 0, limit: 10 },
      emergency: { taken: 0, limit: 4 },
      totalAccrued: 24,
      totalTaken: 0,
    },
  },
];

function recalcAccrual(emps) {
  const now = new Date();
  for (const emp of emps) {
    if (emp.doj && emp.leaveBalance) {
      const doj = new Date(emp.doj);
      const months = Math.max(0, (now.getFullYear() - doj.getFullYear()) * 12 + (now.getMonth() - doj.getMonth()));
      const totalAccrued = months * 2;
      emp.leaveBalance.totalAccrued = totalAccrued;
      emp.leaveBalance.sick.limit = Math.min(2, totalAccrued);
      emp.leaveBalance.casual.limit = Math.min(1, totalAccrued);
      emp.leaveBalance.emergency.limit = Math.min(4, totalAccrued);
    }
  }
  return emps;
}

const DATA_VERSION = "v6";

export const getEmployees = () => {
  const stored = localStorage.getItem("employees");
  const version = localStorage.getItem("employees_version");
  if (stored && version === DATA_VERSION) return recalcAccrual(JSON.parse(stored));
  const seeded = recalcAccrual(employees);
  localStorage.setItem("employees", JSON.stringify(seeded));
  localStorage.setItem("employees_version", DATA_VERSION);
  return seeded;
};

export const saveEmployees = (emps) => {
  localStorage.setItem("employees", JSON.stringify(emps));
};

export const getEmployeeById = (id) => {
  const emps = getEmployees();
  return emps.find((e) => e.id === id);
};

export const getEmployeeByEmail = (email) => {
  const emps = getEmployees();
  return emps.find((e) => e.email === email);
};

export const getManagerById = (id) => {
  const emps = getEmployees();
  return emps.find((e) => e.id === id);
};

export default employees;
