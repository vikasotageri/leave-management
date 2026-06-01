import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return <Navigate to="/login" />;

  if (user.role === "employee") return <Navigate to="/dashboard" />;
  if (user.role === "manager") return <Navigate to="/manager-dashboard" />;
  if (user.role === "hr") return <Navigate to="/hr/dashboard" />;

  return <Navigate to="/login" />;
}
