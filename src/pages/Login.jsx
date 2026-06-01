import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/common/Button";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    const result = await login(email, password);
    if (result.success) {
      const stored = JSON.parse(localStorage.getItem("currentUser"));
      const role = stored?.role;
      if (role === "employee") navigate("/dashboard");
      else if (role === "manager") navigate("/manager-dashboard");
      else if (role === "hr") navigate("/hr/dashboard");
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl flex overflow-hidden">
        {/* Left — Login Form */}
        <div className="w-full max-w-md p-8 flex-shrink-0">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-blue-700">LeaveFlow</h1>
            <p className="text-gray-500 mt-1">Multi-Agent AI Leave Management</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your email"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your password"
                required
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <Button type="submit" className="w-full !py-3">Sign In</Button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-400 text-center mb-2">Demo accounts</p>
            <div className="text-xs text-gray-500 space-y-1">
              <p>👑 HR: <span className="font-mono">hr@company.com</span> / <span className="font-mono">pass123</span></p>
              <p>👔 Manager: <span className="font-mono">manager@company.com</span> / <span className="font-mono">pass123</span></p>
              <p>👤 Employee: <span className="font-mono">emp@company.com</span> / <span className="font-mono">emp123</span></p>
            </div>
          </div>
        </div>

        {/* Right — AI Architecture Showcase */}
        <div className="hidden md:flex flex-1 bg-gradient-to-br from-blue-600 to-indigo-700 p-8 flex-col justify-center text-white">
          <h2 className="text-2xl font-bold mb-4">🤖 Multi-Agent AI Architecture</h2>
          <div className="space-y-4">
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <h3 className="font-semibold text-blue-200 text-sm">🧠 Orchestrator Agent</h3>
              <p className="text-xs text-blue-100 mt-1">Routes queries to the right specialist agent based on intent classification</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                <h3 className="font-semibold text-green-200 text-sm">📋 Policy Agent</h3>
                <p className="text-[10px] text-green-100 mt-1">RAG-powered policy answers with vector search</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                <h3 className="font-semibold text-yellow-200 text-sm">📅 Leave Agent</h3>
                <p className="text-[10px] text-yellow-100 mt-1">Apply, cancel, check status via function calls</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                <h3 className="font-semibold text-purple-200 text-sm">📊 Analytics Agent</h3>
                <p className="text-[10px] text-purple-100 mt-1">Balance, stats, manager/HR info on demand</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
                <h3 className="font-semibold text-pink-200 text-sm">🔗 RAG Engine</h3>
                <p className="text-[10px] text-pink-100 mt-1">OpenAI embeddings + cosine similarity search</p>
              </div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-[11px] text-blue-100">
                <span>⚡ GPT-4o-mini</span>
                <span>•</span>
                <span>🔌 14 Tools</span>
                <span>•</span>
                <span>🗄️ localStorage</span>
                <span>•</span>
                <span>📧 Gmail SMTP</span>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-blue-200 mt-4 italic">
            Each role (Employee, Manager, HR) gets its own set of specialized AI agents
          </p>
        </div>
      </div>
    </div>
  );
}
