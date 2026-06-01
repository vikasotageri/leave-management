from typing import List, Dict, Any


class AgentMemory:
    def __init__(self, max_history: int = 20):
        self.max_history = max_history
        self.conversations: Dict[str, List[Dict]] = {}

    def add(self, user_id: str, role: str, content: str):
        if user_id not in self.conversations:
            self.conversations[user_id] = []
        self.conversations[user_id].append({"role": role, "content": content})
        if len(self.conversations[user_id]) > self.max_history:
            self.conversations[user_id] = self.conversations[user_id][-self.max_history:]

    def get(self, user_id: str) -> List[Dict]:
        return self.conversations.get(user_id, [])

    def get_formatted(self, user_id: str) -> str:
        msgs = self.get(user_id)
        if not msgs:
            return "No conversation history."
        lines = []
        for m in msgs:
            prefix = "User" if m["role"] == "user" else "Assistant"
            lines.append(f"{prefix}: {m['content'][:200]}")
        return "\n".join(lines)

    def clear(self, user_id: str):
        self.conversations.pop(user_id, None)


conversation_memory = AgentMemory()
