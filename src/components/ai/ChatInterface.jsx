import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../services/api";
import { Button } from "../common/Button";

export function ChatInterface() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    { id: "welcome", sender: "agent", text: "🤖 Hi! I'm your **LangGraph Multi-Agent Manager Assistant** with 3 specialized AI agents.", timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { id: Date.now().toString(), sender: "user", text: input.trim(), timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const result = await api.sendChat(input.trim(), user);
      const response = result.response;
      const agentMsg = {
        id: (Date.now() + 1).toString(),
        sender: "agent",
        text: response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch {
      const errMsg = { id: (Date.now() + 1).toString(), sender: "agent", text: "Sorry, I encountered an error.", timestamp: new Date() };
      setMessages((prev) => [...prev, errMsg]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[500px]">
      <div className="p-3 border-b border-gray-100 rounded-t-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <span className="font-medium">LangGraph Multi-Agent AI</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          return (
            <div key={msg.id}>
              <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
                <div className={`max-w-[80%] p-3 rounded-2xl ${isUser ? "bg-blue-600 text-white rounded-br-sm" : "bg-gray-100 text-gray-800 rounded-bl-sm"}`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                  <p className={`text-[10px] mt-1 ${isUser ? "text-blue-200" : "text-gray-400"}`}>
                    {msg.timestamp?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="flex justify-start mb-3">
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm p-3">
              <p className="text-sm text-gray-500">Routing via LangGraph...</p>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t border-gray-100">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about team, approvals, or analytics..."
            rows={1}
            className="flex-1 p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
          />
          <Button onClick={handleSend} disabled={loading || !input.trim()} className="!px-5">
            {loading ? "..." : "Send"}
          </Button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">Enter to send, Shift+Enter for new line</p>
      </div>
    </div>
  );
}
