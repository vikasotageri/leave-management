import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LeaveProvider } from "./contexts/LeaveContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { EmployeeProvider } from "./contexts/EmployeeContext";
import { Navbar } from "./components/common/Navbar";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { EmployeeDashboard } from "./pages/EmployeeDashboard";
import { ManagerDashboard } from "./pages/ManagerDashboard";
import { HRDashboard } from "./pages/HRDashboard";
import { ChatPage } from "./pages/ChatPage";

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-500">Loading...</p></div>;
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === "employee") return <Navigate to="/dashboard" />;
    if (user.role === "manager") return <Navigate to="/manager-dashboard" />;
    if (user.role === "hr") return <Navigate to="/hr/dashboard" />;
    return <Navigate to="/login" />;
  }
  return children;
}

function AppLayout({ children, allowedRoles }) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main>{children}</main>
      </div>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <LeaveProvider>
            <EmployeeProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Home />} />

                <Route path="/dashboard" element={<AppLayout allowedRoles={["employee"]}><EmployeeDashboard /></AppLayout>} />
                <Route path="/apply" element={<AppLayout allowedRoles={["employee"]}><EmployeeDashboard /></AppLayout>} />
                <Route path="/manager-dashboard" element={<AppLayout allowedRoles={["manager"]}><ManagerDashboard /></AppLayout>} />
                <Route path="/manager/team" element={<AppLayout allowedRoles={["manager"]}><ManagerDashboard /></AppLayout>} />
                <Route path="/hr/dashboard" element={<AppLayout allowedRoles={["hr"]}><HRDashboard /></AppLayout>} />
                <Route path="/hr/employees" element={<AppLayout allowedRoles={["hr"]}><HRDashboard /></AppLayout>} />
                <Route path="/chat" element={<AppLayout allowedRoles={["manager"]}><ChatPage /></AppLayout>} />

                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </EmployeeProvider>
          </LeaveProvider>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
