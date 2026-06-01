import { useAuth } from "../contexts/AuthContext";
import { ChatInterface } from "../components/ai/ChatInterface";

export function ChatPage() {
  const { user } = useAuth();
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Multi-Agent AI Assistant</h1>
        <p className="text-gray-500">3 specialized agents — Team, Approvals, Analytics</p>
      </div>
      <ChatInterface />
      <div className="mt-4 bg-blue-50 rounded-xl p-4 border border-blue-200">
        <p className="text-sm font-medium text-blue-800 mb-2">Try these:</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-blue-600">
          <p>✅ "Show pending approvals"</p>
          <p>👥 "Tell me about EMP001"</p>
          <p>📊 "How many requests today?"</p>
          <p>✅ "Approve L-xxx"</p>
          <p>👥 "Who's on leave today?"</p>
          <p>📊 "Team overview"</p>
        </div>
      </div>
    </div>
  );
}
