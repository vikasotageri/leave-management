import os
import json
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage
from agents.tools import TOOLS
from ai_engine.agent_memory import conversation_memory

load_dotenv()

model = ChatOpenAI(model="gpt-4o-mini", api_key=os.getenv("OPENAI_API_KEY"))
model_with_tools = model.bind_tools(TOOLS)


def classify_intent(message: str, user: dict, agents: list) -> str:
    descriptions = "\n".join(f'{i+1}. "{a["name"]}" - {a["description"]}' for i, a in enumerate(agents))
    try:
        response = model.invoke(
            [SystemMessage(content=f"Route user messages to the correct agent. Available agents:\n{descriptions}\n\nUser role: {user.get('role')}\nRespond with ONLY the exact agent name."),
             HumanMessage(content=message)],
            temperature=0.1, max_tokens=30,
        )
        agent_name = response.content.strip()
        matched = next((a["name"] for a in agents if a["name"] == agent_name), agents[0]["name"])
        return matched
    except Exception as e:
        print(f"Supervisor error: {e}")
        return agents[0]["name"]


def call_agent_with_tools(system_prompt: str, user_message: str, user: dict) -> str:
    user_context = f"\n\nCurrent user: {user.get('name')} (ID: {user.get('id')}, Role: {user.get('role')})"
    history = conversation_memory.get_formatted(user.get("id", ""))

    messages = [
        SystemMessage(content=system_prompt + user_context + f"\n\nConversation History:\n{history}"),
        HumanMessage(content=user_message),
    ]

    result = model_with_tools.invoke(messages)

    max_rounds = 5
    for _ in range(max_rounds):
        if not result.tool_calls:
            break

        messages.append(result)
        for tc in result.tool_calls:
            tool = next((t for t in TOOLS if t.name == tc["name"]), None)
            if tool:
                try:
                    output = tool.invoke(tc["args"])
                except Exception as e:
                    output = {"success": False, "error": str(e)}
            else:
                output = {"error": f"Unknown tool: {tc['name']}"}
            content = json.dumps(output) if isinstance(output, dict) else str(output)
            messages.append(ToolMessage(content=content, tool_call_id=tc["id"]))

        result = model_with_tools.invoke(messages)

    reply = result.content or "I processed your request."
    conversation_memory.add(user.get("id", ""), "user", user_message)
    conversation_memory.add(user.get("id", ""), "assistant", reply)
    return reply
