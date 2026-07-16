import os
import json
from typing import TypedDict, List, Dict, Optional, AsyncGenerator, Any
from langgraph.graph import StateGraph, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from core.deps import GEMINI_API_KEY
from services.tools import (
    execute_tool_plan,
    compute_from_memories,
    route_tools,
    merge_documents,
    should_refine_retrieval,
)

SERVICES_DIR = os.path.dirname(os.path.abspath(__file__))

with open(f"{SERVICES_DIR}/doobiesysprompt.txt", "r") as f:
    DOOBIE_SYSTEM_PROMPT = f.read()

with open(f"{SERVICES_DIR}/llmasjudgeprompt.txt", "r") as f:
    JUDGE_SYSTEM_PROMPT = f.read()

EXTRACT_NUMBERS_PROMPT = """Extract numeric values from these journal memories relevant to the user's question.
Every value MUST cite a source_entry_id that appears in the documents below.

Return ONLY valid JSON (no markdown):
{"values": [{"value": 1200, "source_entry_id": "uuid", "excerpt": "short quote containing the number"}]}

If no relevant numbers exist, return {"values": []}.
Do NOT invent numbers. Only extract numbers explicitly present in the text."""

REFINE_RETRIEVAL_PROMPT = """Heuristics ran but journal results were weak. Pick ONE follow-up tool or "none".
Tools: search_journal_semantic, search_journal_by_date_range, get_recent_entries, search_by_location
Return ONLY JSON: {"action": "tool_name_or_none", "args": {}}"""


class GraphState(TypedDict):
    question: str
    chat_history: List[Dict]
    standalone_query: str
    user_id: str
    user_name: str
    token: str
    documents: List[Dict]
    answer: str
    attempts: int
    judge_feedback: str
    tool_plan: Dict
    computation_result: Optional[Dict]
    retrieval_rounds: int


judge_llm = ChatGoogleGenerativeAI(
    model="gemini-3.1-flash-lite",
    google_api_key=GEMINI_API_KEY,
    temperature=0.0,
)
chat_llm = ChatGoogleGenerativeAI(
    model="gemini-3.1-flash-lite",
    google_api_key=GEMINI_API_KEY,
    temperature=0.7,
)


def build_initial_state(
    question: str,
    chat_history: List[Dict],
    user_id: str,
    user_name: str,
    token: str,
) -> GraphState:
    return {
        "question": question,
        "chat_history": chat_history,
        "standalone_query": "",
        "user_id": user_id,
        "user_name": user_name,
        "token": token,
        "documents": [],
        "answer": "",
        "attempts": 0,
        "judge_feedback": "",
        "tool_plan": {},
        "computation_result": None,
        "retrieval_rounds": 0,
    }


def extract_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        if not content:
            return ""
        parts = []
        for part in content:
            if isinstance(part, dict) and "text" in part:
                parts.append(part["text"])
            elif isinstance(part, str):
                parts.append(part)
        return " ".join(parts) if parts else ""
    return str(content)


def _parse_json(text: str) -> dict:
    cleaned = text.replace("```json", "").replace("```", "").strip()
    return json.loads(cleaned)


def rewrite_query(state: GraphState):
    question = state["question"]
    chat_history = state.get("chat_history", [])

    if not chat_history:
        return {"standalone_query": question}

    history_text = "\n".join(
        [f"{msg['role'].upper()}: {msg['content']}" for msg in chat_history]
    )
    prompt = f"""Given the following conversation and a follow-up question, rephrase the follow-up question to be a standalone search query.
If the question is already clear and standalone, do NOT change it. Do not invent keywords.

Conversation History:
{history_text}

Follow-up Question: {question}
Standalone Query:"""

    response = chat_llm.invoke(
        [
            SystemMessage(content="You are an expert at optimizing search queries."),
            HumanMessage(content=prompt),
        ]
    )
    standalone_query = extract_text(response.content).strip()
    print(f"REWRITTEN QUERY: '{question}' -> '{standalone_query}'")
    return {"standalone_query": standalone_query}


def plan_tools(state: GraphState):
    question = state.get("standalone_query") or state["question"]
    plan = route_tools(question)
    print(f"TOOL PLAN: {plan}")
    return {"tool_plan": plan}


def execute_tools(state: GraphState):
    plan = state.get("tool_plan") or {}
    tools = plan.get("tools") or []
    if not tools:
        query = state.get("standalone_query") or state["question"]
        tools = [{"name": "search_journal_semantic", "args": {"query": query}}]

    documents = execute_tool_plan(tools, state["user_id"], state["token"])
    return {
        "documents": documents,
        "attempts": state.get("attempts", 0),
        "judge_feedback": state.get("judge_feedback", ""),
    }


def maybe_refine_retrieval(state: GraphState, emit_status: bool = False):
    """Agent-lite: one optional LLM-guided retrieval retry when first pass is weak."""
    question = state.get("standalone_query") or state["question"]
    documents = state.get("documents") or []
    rounds = state.get("retrieval_rounds", 0)

    if not should_refine_retrieval(documents, question, state.get("chat_history", []), rounds):
        return {"retrieval_rounds": rounds}

    result: Dict[str, Any] = {"retrieval_rounds": rounds + 1}
    if emit_status:
        result["status_message"] = "Digging a little deeper..."

    tools_tried = (state.get("tool_plan") or {}).get("tools") or []
    prompt = (
        f"{REFINE_RETRIEVAL_PROMPT}\n\n"
        f"Question: {question}\n"
        f"Already tried: {json.dumps(tools_tried)}\n"
        f"Documents found: {len(documents)}\n\n"
        f"JSON:"
    )

    try:
        response = chat_llm.bind(temperature=0).invoke([HumanMessage(content=prompt)])
        decision = _parse_json(extract_text(response.content))
        action = decision.get("action", "none")
        args = decision.get("args") or {}
    except Exception as e:
        print(f"Retrieval refine failed: {e}")
        return result

    if action == "none" or not action:
        print("RETRIEVAL REFINE: none")
        return result

    valid_tools = {
        "search_journal_semantic",
        "search_journal_by_date_range",
        "get_recent_entries",
        "search_by_location",
    }
    if action not in valid_tools:
        print(f"RETRIEVAL REFINE: invalid action {action}")
        return result

    print(f"RETRIEVAL REFINE: {action} {args}")
    new_docs = execute_tool_plan([{"name": action, "args": args}], state["user_id"], state["token"])
    result["documents"] = merge_documents(documents, new_docs)
    return result


def extract_and_compute(state: GraphState):
    plan = state.get("tool_plan") or {}
    if not plan.get("needs_computation"):
        return {"computation_result": None}

    documents = state.get("documents") or []
    if not documents:
        return {"computation_result": {"success": False, "reason": "no_numbers_in_context"}}

    allowed_ids = {d["entry_id"] for d in documents}
    docs_text = "\n\n".join(
        [f"entry_id={d['entry_id']}\n{d['chunk_content']}" for d in documents]
    )
    prompt = f"{EXTRACT_NUMBERS_PROMPT}\n\nUser question: {state['question']}\n\nDocuments:\n{docs_text}"

    try:
        response = chat_llm.bind(temperature=0).invoke([HumanMessage(content=prompt)])
        extracted = _parse_json(extract_text(response.content))
        values = extracted.get("values") or []
    except Exception as e:
        print(f"Number extraction failed: {e}")
        values = []

    operation = plan.get("computation_operation") or "sum"
    label = state.get("standalone_query") or state["question"]
    result = compute_from_memories(operation, values, allowed_ids, label=label)
    print(f"COMPUTATION: {result}")
    return {"computation_result": result}


def build_context_text(state: GraphState) -> str:
    documents = state.get("documents") or []
    parts = [f"[{i}] - {d['chunk_content']}" for i, d in enumerate(documents)]

    computation = state.get("computation_result")
    if computation and computation.get("success"):
        op = computation.get("operation", "")
        val = computation.get("result")
        sources = computation.get("sources") or []
        source_lines = [
            f"  - {s['value']} (from entry {s['source_entry_id'][:8]}...): \"{s.get('excerpt', '')}\""
            for s in sources
        ]
        parts.append(
            f"\n[Computed from your memories — {op} = {val}]\n" + "\n".join(source_lines)
        )

    return "\n\n".join(parts) if parts else ""


def build_generate_messages(state: GraphState) -> list:
    question = state["question"]
    context_text = build_context_text(state)
    user_name = state.get("user_name", "my friend")
    judge_feedback = state.get("judge_feedback", "")

    system_content = (
        DOOBIE_SYSTEM_PROMPT.replace("{context_text}", context_text)
        .replace("{query}", question)
        .replace("{user_name}", user_name)
    )

    if judge_feedback:
        system_content += f"\n\nWARNING - PREVIOUS ATTEMPT FAILED. FIX THIS: {judge_feedback}"

    messages = [SystemMessage(content=system_content)]
    for msg in state.get("chat_history", []):
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        else:
            messages.append(AIMessage(content=msg["content"]))

    messages.append(
        HumanMessage(
            content=question
            + "\n\n[CRITICAL INSTRUCTION: You MUST reply entirely in the exact same language as my question above. "
            "If my question is in English, reply in English. If my question is in Hinglish/Hindi, reply in Hinglish.]"
        )
    )
    return messages


async def stream_generate_tokens(state: GraphState) -> AsyncGenerator[str, None]:
    messages = build_generate_messages(state)
    async for chunk in chat_llm.astream(messages):
        token = extract_text(chunk.content)
        if token:
            yield token


def generate(state: GraphState):
    messages = build_generate_messages(state)
    response = chat_llm.invoke(messages)
    return {"answer": extract_text(response.content), "attempts": state.get("attempts", 0) + 1}


def evaluate_response(state: GraphState):
    question = state["question"]
    documents = state["documents"]
    answer = state["answer"]
    context_text = build_context_text(state)
    user_name = state.get("user_name", "my friend")

    system_content = (
        JUDGE_SYSTEM_PROMPT.replace("{context_text}", context_text)
        .replace("{query}", question)
        .replace("{response}", answer)
        .replace("{user_name}", user_name)
    )

    response = judge_llm.invoke(
        [
            SystemMessage(content=system_content),
            HumanMessage(
                content="Please evaluate Doobie's response based on the criteria above and return the JSON score."
            ),
        ]
    )

    feedback = ""
    filtered_documents = documents
    try:
        text = extract_text(response.content).replace("```json", "").replace("```", "").strip()
        score_json = json.loads(text)
        faithfulness = score_json.get("faithfulness_score", 5)
        safety = str(score_json.get("safety_handling", "pass")).lower()
        language_match = str(score_json.get("language_match", "pass")).lower()
        used_refs = score_json.get("used_references", [])

        if faithfulness <= 3 or safety == "fail":
            rationale = score_json.get("rationale", "Unknown failure.")
            hallucinations = score_json.get("hallucinated_claims", [])
            feedback = f"Failed criteria! Rationale: {rationale}. Hallucinations: {hallucinations}"
            print(f"JUDGE FAILED DOOBIE: {feedback}")
        elif language_match == "fail":
            rationale = score_json.get("rationale", "Wrong reply language.")
            feedback = (
                f"Language mismatch! {rationale} "
                "Rewrite entirely in the same language as the user's question. "
                "If they asked in English, use English only — no Hindi or Hinglish words."
            )
            print(f"JUDGE FAILED DOOBIE (language): {feedback}")
        elif isinstance(used_refs, list):
            valid_refs = [r for r in used_refs if isinstance(r, int) and 0 <= r < len(documents)]
            filtered_documents = [documents[i] for i in valid_refs]
    except Exception as e:
        print(f"Judge parsing failed: {e}")

    return {"judge_feedback": feedback, "documents": filtered_documents}


def check_score(state: GraphState):
    if state.get("judge_feedback") and state.get("attempts", 0) < 2:
        return "regenerate"
    return "end"


async def stream_doobie_events(state: GraphState) -> AsyncGenerator[Dict[str, Any], None]:
    """Single pipeline for SSE streaming."""
    try:
        yield {"type": "status", "message": "Rewriting your question..."}
        state = {**state, **rewrite_query(state)}

        yield {"type": "status", "message": "Searching your traces..."}
        state = {**state, **plan_tools(state)}
        state = {**state, **execute_tools(state)}

        refine = maybe_refine_retrieval(state, emit_status=True)
        if refine.get("status_message"):
            yield {"type": "status", "message": refine["status_message"]}
            refine = {k: v for k, v in refine.items() if k != "status_message"}
        state = {**state, **refine}

        if state.get("tool_plan", {}).get("needs_computation"):
            yield {"type": "status", "message": "Adding up what you've told me..."}
            state = {**state, **extract_and_compute(state)}

        yield {"type": "retrieved", "context": state["documents"]}

        yield {"type": "status", "message": "Doobie is thinking..."}
        answer_parts: List[str] = []
        async for token in stream_generate_tokens(state):
            answer_parts.append(token)
            yield {"type": "token", "content": token}

        state["answer"] = "".join(answer_parts)
        state["attempts"] = state.get("attempts", 0) + 1
        state = {**state, **evaluate_response(state)}

        if state.get("judge_feedback") and state.get("attempts", 0) < 2:
            yield {"type": "regenerating", "message": "Let me think again..."}
            answer_parts = []
            async for token in stream_generate_tokens(state):
                answer_parts.append(token)
                yield {"type": "token", "content": token}
            state["answer"] = "".join(answer_parts)
            state["attempts"] = state.get("attempts", 0) + 1
            state = {**state, **evaluate_response(state)}

        yield {
            "type": "done",
            "answer": state["answer"],
            "context": state["documents"],
            "computation": state.get("computation_result"),
        }
    except Exception as e:
        print(f"Stream error: {e}")
        yield {"type": "error", "message": "Doobie encountered an error"}


# LangGraph for non-streaming POST /api/chat
workflow = StateGraph(GraphState)
workflow.add_node("rewrite_query", rewrite_query)
workflow.add_node("plan_tools", plan_tools)
workflow.add_node("execute_tools", execute_tools)
workflow.add_node("maybe_refine_retrieval", maybe_refine_retrieval)
workflow.add_node("extract_and_compute", extract_and_compute)
workflow.add_node("generate", generate)
workflow.add_node("evaluate_response", evaluate_response)

workflow.set_entry_point("rewrite_query")
workflow.add_edge("rewrite_query", "plan_tools")
workflow.add_edge("plan_tools", "execute_tools")
workflow.add_edge("execute_tools", "maybe_refine_retrieval")
workflow.add_edge("maybe_refine_retrieval", "extract_and_compute")
workflow.add_edge("extract_and_compute", "generate")
workflow.add_edge("generate", "evaluate_response")
workflow.add_conditional_edges(
    "evaluate_response", check_score, {"regenerate": "generate", "end": END}
)

doobie_graph = workflow.compile()
