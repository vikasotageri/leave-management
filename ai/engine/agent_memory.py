"""
================================================================================
 LEAVE FLOW — Agent Conversation Memory
================================================================================

 PURPOSE:
  Maintains per-user conversation history for the LangGraph AI agents.
  Stores the last N exchanges so the LLM has context across multiple messages.

 CALLED BY:
  - ai/agents/supervisor.py (line 33): call_agent_with_tools()
      → Gets formatted history before sending to LLM
      → Saves user question + assistant response after each turn
  - ai/agents/tools.py (line 880): get_agent_memory tools
  - backend/routers/chat.py (line 26): Chat history persistence

 WHERE IT FITS (AI FLOW):
  User types message → Frontend sends POST /api/chat
    → chat.py router → LangGraph StateGraph
      → supervisor.py classify_intent()
      → specialist agent (call_agent_with_tools)
        → reads conversation_memory for context ← THIS FILE
        → LLM generates response with tool calls
        → saves to conversation_memory ← THIS FILE
    → Returns response to frontend

 DESIGN:
  - In-memory dict (not persisted to DB — resets on server restart)
  - Max 20 exchanges per user to limit token usage
  - get_formatted() returns a plain-text summary for the LLM prompt
================================================================================
"""

from typing import List, Dict, Any


class AgentMemory:
    """
    Manages per-user conversation history for AI agent context.

    Attributes:
        max_history (int): Maximum conversation turns to keep per user
        conversations (dict): {user_id: [{role, content}, ...]}

    Usage:
        memory = AgentMemory()
        memory.add("EMP001", "user", "What is my leave balance?")
        memory.add("EMP001", "assistant", "You have 12 sick days remaining.")
        history = memory.get_formatted("EMP001")
    """

    def __init__(self, max_history: int = 20):
        self.max_history = max_history
        self.conversations: Dict[str, List[Dict]] = {}

    def add(self, user_id: str, role: str, content: str):
        """
        Add a message to a user's conversation history.
        Trims oldest messages if exceeding max_history.

        Args:
            user_id: Employee ID (e.g., "EMP001")
            role:    "user" or "assistant"
            content: The message text
        """
        if user_id not in self.conversations:
            self.conversations[user_id] = []
        self.conversations[user_id].append({"role": role, "content": content})
        if len(self.conversations[user_id]) > self.max_history:
            self.conversations[user_id] = self.conversations[user_id][-self.max_history:]

    def get(self, user_id: str) -> List[Dict]:
        """
        Get raw conversation history for a user.
        Returns empty list if no history exists.
        """
        return self.conversations.get(user_id, [])

    def get_formatted(self, user_id: str) -> str:
        """
        Get formatted conversation history as a plain-text string.
        Used by supervisor.py to inject context into the LLM system prompt.

        Format:
            User: message text
            Assistant: response text

        Returns "No conversation history." if none exists.
        """
        msgs = self.get(user_id)
        if not msgs:
            return "No conversation history."
        lines = []
        for m in msgs:
            prefix = "User" if m["role"] == "user" else "Assistant"
            lines.append(f"{prefix}: {m['content'][:200]}")
        return "\n".join(lines)

    def clear(self, user_id: str):
        """
        Clear all conversation history for a user.
        Called when user explicitly clears chat or resets.
        """
        self.conversations.pop(user_id, None)


# Singleton instance shared across the application
# Imported by: supervisor.py, tools.py, chat.py
conversation_memory = AgentMemory()
