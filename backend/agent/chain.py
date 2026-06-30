"""Custom agent setup for the Nova sales assistant.

Uses prompt-based tool calling instead of LangChain's native bind_tools,
because the Groq Llama model is unreliable with multiple bound tools.
Supports session-aware memory via ChatSession history.
"""

import json
import os
import re
from typing import Any, Optional

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.tools import BaseTool

from backend.agent.prompts import SYSTEM_PROMPT, MEMORY_CONTEXT_PROMPT
from backend.agent.tools import get_all_tools
from backend.core.logging_config import get_logger
from backend.services.booking_store import pop_last_booking

log = get_logger("chain")


# ── Helpers ────────────────────────────────────────────────────


def _create_model():
    """Create the chat model instance — Groq preferred, Gemini fallback."""
    groq_key = os.getenv("GROQ_API_KEY", "")
    gemini_key = os.getenv("GEMINI_API_KEY", "")

    if groq_key:
        from langchain_groq import ChatGroq

        return ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0.3,
            max_tokens=384,
            api_key=groq_key,
        )
    elif gemini_key:
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            temperature=0.5,
            max_tokens=512,
            api_key=gemini_key,
        )
    else:
        raise ValueError("Set GEMINI_API_KEY or GROQ_API_KEY in your .env file.")


def _build_tool_descriptions(tools: list[BaseTool]) -> str:
    """Build a text description of all tools with their parameters."""
    parts = []
    for t in tools:
        schema = t.get_input_schema().model_json_schema()
        props = schema.get("properties", {})
        required = schema.get("required", [])
        param_lines = []
        for name, info in props.items():
            req = " (required)" if name in required else " (optional)"
            ptype = info.get("type", "string")
            desc = info.get("description", "")
            param_lines.append(f"    {name}: {ptype}{req} — {desc}")
        params_str = "\n".join(param_lines) if param_lines else "    (no parameters)"
        parts.append(
            f"Tool: {t.name}\n"
            f"  Description: {t.description}\n"
            f"  Parameters:\n{params_str}"
        )
    return "\n\n".join(parts)


def _build_tool_prompt(tools: list[BaseTool]) -> str:
    """Build the tool-calling instruction appended to the system prompt."""
    descs = _build_tool_descriptions(tools)
    return (
        "\n\n── AVAILABLE TOOLS ──\n\n"
        f"{descs}\n\n"
        "── HOW TO USE TOOLS ──\n\n"
        "When you need to get information to answer the user, call a tool by "
        'responding with ONLY a JSON block like this (no other text):\n\n'
        '{"tool": "tool_name", "arguments": {"param1": "value1", ...}}\n\n'
        "IMPORTANT: After you receive the tool result, you MUST include the "
        "key details from that result in your response to the user. Do not "
        "just acknowledge it — share the actual information (course names, "
        "prices, durations, etc.) directly in your answer.\n\n"
        "You can call multiple tools one at a time if needed.\n"
        "If the user is asking a simple question you can answer directly, "
        "just respond normally without calling a tool."
    )


# ── Tool Execution ─────────────────────────────────────────────


async def _execute_tool(tool_name: str, arguments: dict, tools: list[BaseTool]) -> str:
    """Execute a tool by name with the given arguments."""
    for t in tools:
        if t.name == tool_name:
            log.info("Executing tool: %s(%s)", t.name, arguments)
            try:
                result = t._run(**arguments)
                if result:
                    return result
            except NotImplementedError:
                pass
            try:
                result = await t._arun(**arguments)
                return result or ""
            except Exception as e:
                return f"Error calling {tool_name}: {e}"
    return f"Unknown tool: {tool_name}"


# ── JSON Extraction ────────────────────────────────────────────


def _extract_tool_call(text: str) -> Optional[dict]:
    """Extract a JSON tool call from the model's response text."""
    # Try to find JSON block
    json_pattern = r'\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}'
    matches = re.findall(json_pattern, text, re.DOTALL)
    for match in matches:
        try:
            obj = json.loads(match)
            if isinstance(obj, dict) and "tool" in obj and "arguments" in obj:
                return obj
        except json.JSONDecodeError:
            continue
    return None


# ── Session History ────────────────────────────────────────────


def _load_session_history(session_id: str, max_pairs: int = 5) -> list:
    """Load recent chat history from SQLite for session context."""
    try:
        from backend.db.sqlite_setup import ChatSession, get_session
        db = get_session()
        try:
            records = (
                db.query(ChatSession)
                .filter(ChatSession.session_id == session_id)
                .order_by(ChatSession.created_at.desc())
                .limit(max_pairs * 2)
                .all()
            )
            records.reverse()
            messages = []
            for r in records:
                if r.role == "user":
                    messages.append(HumanMessage(content=r.content))
                elif r.role == "ai":
                    messages.append(AIMessage(content=r.content))
            return messages
        finally:
            db.close()
    except Exception as e:
        log.warning("Failed to load session history: %s", e, exc_info=True)
        return []


# ── Agent Executor ─────────────────────────────────────────────


class NovaAgent:
    """A simple agent that uses prompt-based tool calling."""

    def __init__(self, model, tools: list[BaseTool]):
        self.model = model
        self.tools = tools
        self.tool_prompt = _build_tool_prompt(tools)

    async def _call_model(self, messages: list) -> str:
        """Call the model with messages and return the response text."""
        result = await self.model.ainvoke(messages)
        return result.content or ""

    async def ainvoke(self, state: dict) -> dict:
        """Process messages and return final state with responses.

        State may include a "user" key (the authenticated user or None)
        to gate enrollment-related tools.
        """
        messages = list(state.get("messages", []))
        user = state.get("user")
        max_iterations = 3

        for iteration in range(max_iterations):
            # Build the messages with system prompt and tool instructions
            full_messages = [
                SystemMessage(content=SYSTEM_PROMPT + self.tool_prompt)
            ]
            full_messages.extend(messages)

            log.info("Iteration %d, calling model...", iteration + 1)
            response_text = await self._call_model(full_messages)

            # Check if the response contains a tool call
            tool_call = _extract_tool_call(response_text)
            if tool_call:
                log.info("Tool call detected: %s", tool_call)
                messages.append(HumanMessage(content=response_text))

                tool_name = tool_call["tool"]
                arguments = tool_call["arguments"]

                # ── Auth gate: block booking if not logged in ──
                if tool_name == "book_course" and not user:
                    tool_result = (
                        "I'm sorry, you need to be logged in to enroll in a course. "
                        "Please create an account or log in first, then try again."
                    )
                else:
                    # Execute the tool
                    tool_result = await _execute_tool(tool_name, arguments, self.tools)

                # Add tool result as a message
                messages.append(AIMessage(content=f"[Tool result from {tool_name}]: {tool_result}"))
            else:
                # No tool call — this is the final answer
                messages.append(AIMessage(content=response_text))
                return {"messages": messages}

        # If we exceeded max iterations, return the last response
        return {"messages": messages}


def create_agent_executor():
    """Create and return the Nova agent."""
    model = _create_model()
    tools = get_all_tools()
    return NovaAgent(model=model, tools=tools)


async def run_agent(question: str, agent, session_id: str = "", user: Optional[Any] = None) -> dict:
    """Run the agent with a question and return structured result.

    Args:
        question: The user's transcribed question text.
        agent: The NovaAgent instance.
        session_id: Optional session ID for loading chat history context.
        user: Optional authenticated user object. If None, booking tools are blocked.

    Returns:
        dict with keys:
          - response (str): The agent's answer text.
          - booking_created (bool): Whether a new enrollment was created.
          - booking_id (str or None): The booking ID if created.
          - booking_details (dict or None): Details of the booking.
    """
    try:
        messages = []

        if session_id:
            history = _load_session_history(session_id, max_pairs=5)
            if history:
                context_note = HumanMessage(content=MEMORY_CONTEXT_PROMPT)
                messages.append(context_note)
                messages.extend(history)

        messages.append(HumanMessage(content=question))
        log.info("Invoking agent with %d messages, last: %.60s", len(messages), question)

        result = await agent.ainvoke({"messages": messages, "user": user})
        log.info("Agent returned with %d messages", len(result.get("messages", [])))

        # Build the final response: tool results + final AI message
        answer = ""
        tool_data = []
        final_ai = ""
        for msg in result["messages"]:
            content = msg.content or ""
            if msg.type == "ai" and content.startswith("[Tool result from"):
                # Extract the actual data after the prefix
                data = content.split("]:", 1)[-1].strip()
                if data:
                    tool_data.append(data)
            elif msg.type == "ai" and not content.startswith("[Tool result from"):
                final_ai = content

        # Always include tool result data if available, then append AI message
        if tool_data:
            answer = "\n".join(tool_data)
            if final_ai.strip():
                answer += "\n\n" + final_ai.strip()
        elif final_ai:
            answer = final_ai
        else:
            answer = str(result)
        answer = answer.strip()

        # Check if a booking was created during this agent invocation
        booking = pop_last_booking()
        if booking:
            return {
                "response": answer,
                "booking_created": True,
                "booking_id": booking.booking_id,
                "booking_details": {
                    "booking_id": booking.booking_id,
                    "student_name": booking.student_name,
                    "email": booking.email,
                    "course_title": booking.course_title,
                    "amount_due": booking.amount_due,
                    "payment_option": booking.payment_option,
                    "status": booking.status,
                },
            }

        return {
            "response": answer,
            "booking_created": False,
            "booking_id": None,
            "booking_details": None,
        }
    except Exception as e:
        err_str = str(e)
        log.error("Agent error: %s: %.200s", type(e).__name__, err_str, exc_info=True)
        try:
            import sentry_sdk
            sentry_sdk.capture_exception(e)
        except ImportError:
            pass
        if "429" in err_str or "rate limit" in err_str.lower() or "quota" in err_str.lower():
            return {
                "response": "I'm currently experiencing high demand and my API rate limit has been reached. Please wait a moment and try again! In the meantime, you can explore our courses at devnestacademy.com.",
                "booking_created": False,
                "booking_id": None,
                "booking_details": None,
            }
        return {
            "response": "I'm sorry, I ran into a technical issue while processing your question. Could you please try rephrasing it?",
            "booking_created": False,
            "booking_id": None,
            "booking_details": None,
        }
