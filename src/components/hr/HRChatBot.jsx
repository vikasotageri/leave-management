import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../services/api";

export function HRChatBot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: "welcome", sender: "agent", text: "🤖 Hi! I'm your **LangGraph Multi-Agent HR Assistant** with 2 specialized AI agents.", timestamp: new Date() },
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
      const agentMsg = { id: (Date.now() + 1).toString(), sender: "agent", text: response, timestamp: new Date() };
      setMessages((prev) => [...prev, agentMsg]);
    } catch {
      const errMsg = { id: (Date.now() + 1).toString(), sender: "agent", text: "Sorry, error occurred.", timestamp: new Date() };
      setMessages((prev) => [...prev, errMsg]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-xl flex items-center justify-center text-2xl cursor-pointer transition hover:scale-105"
        title="HR AI Assistant"
      >🤖</button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col" style={{ maxHeight: "500px" }}>
          <div className="p-3 border-b border-gray-100 rounded-t-2xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <span className="font-semibold text-sm">LangGraph HR AI</span>
              <button onClick={() => setOpen(false)} className="ml-auto text-white/80 hover:text-white text-lg cursor-pointer">&times;</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ minHeight: "200px", maxHeight: "340px" }}>
            {messages.map((msg) => {
              const isUser = msg.sender === "user";
              return (
                <div key={msg.id}>
                  <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] p-2.5 rounded-2xl ${isUser ? "bg-purple-600 text-white rounded-br-sm" : "bg-gray-100 text-gray-800 rounded-bl-sm"}`}>
                      <p className="text-xs whitespace-pre-wrap">{msg.text}</p>
                      <p className={`text-[9px] mt-1 ${isUser ? "text-purple-200" : "text-gray-400"}`}>
                        {msg.timestamp?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm p-3">
                  <p className="text-xs text-gray-500">Routing via LangGraph...</p>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="p-3 border-t border-gray-100">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="View employees, org data..."
                className="flex-1 p-2 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button onClick={handleSend} disabled={loading || !input.trim()} className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 cursor-pointer">
                {loading ? "..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
