"""Journal-grounded agent tools for Doobie."""
import re
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional, Set, Any
from supabase import create_client, ClientOptions
from core.deps import SUPABASE_URL, SUPABASE_KEY
from services.ai import generate_query_embedding, translate_to_english


def _client(token: str):
    return create_client(
        SUPABASE_URL,
        SUPABASE_KEY,
        options=ClientOptions(headers={"Authorization": f"Bearer {token}"}),
    )


def _entry_to_doc(entry: dict) -> dict:
    content = (entry.get("content") or entry.get("english_translation") or "").strip()
    return {
        "chunk_content": content,
        "entry_id": entry["id"],
        "full_content": content,
        "created_at": entry.get("created_at"),
        "location": entry.get("location"),
    }


def merge_documents(existing: List[Dict], new: List[Dict]) -> List[Dict]:
    seen = {d["entry_id"] for d in existing}
    merged = list(existing)
    for doc in new:
        if doc["entry_id"] not in seen and doc.get("chunk_content"):
            merged.append(doc)
            seen.add(doc["entry_id"])
    return merged


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def parse_date_range(question: str) -> Optional[Dict[str, str]]:
    q = question.lower()
    now = datetime.now(timezone.utc)

    if "today" in q:
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return {"start_date": _iso(start), "end_date": _iso(now)}
    if "yesterday" in q:
        end = now.replace(hour=0, minute=0, second=0, microsecond=0)
        start = end - timedelta(days=1)
        return {"start_date": _iso(start), "end_date": _iso(end)}
    if "last week" in q or "past week" in q:
        return {"start_date": _iso(now - timedelta(days=7)), "end_date": _iso(now)}
    if "this week" in q:
        start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        return {"start_date": _iso(start), "end_date": _iso(now)}
    if "last month" in q or "past month" in q:
        return {"start_date": _iso(now - timedelta(days=30)), "end_date": _iso(now)}
    if "this month" in q:
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return {"start_date": _iso(start), "end_date": _iso(now)}
    return None


_COMPARE_RE = re.compile(r"\b(vs|versus|compared|compare|before and after|then vs|different)\b", re.I)


def is_compare_intent(question: str) -> bool:
    return bool(_COMPARE_RE.search(question))


def parse_compare_periods(question: str) -> Optional[List[Dict[str, str]]]:
    """Detect two-period compare queries and return two date ranges (no LLM)."""
    if not is_compare_intent(question):
        return None

    q = question.lower()
    now = datetime.now(timezone.utc)

    if ("last month" in q and "this month" in q) or ("last month" in q and "now" in q):
        this_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_end = this_start - timedelta(seconds=1)
        last_start = last_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return [
            {"start_date": _iso(last_start), "end_date": _iso(last_end)},
            {"start_date": _iso(this_start), "end_date": _iso(now)},
        ]

    if "last week" in q and "this week" in q:
        this_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        last_end = this_start - timedelta(seconds=1)
        last_start = (last_end - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
        return [
            {"start_date": _iso(last_start), "end_date": _iso(last_end)},
            {"start_date": _iso(this_start), "end_date": _iso(now)},
        ]

    return None


def should_refine_retrieval(documents: List[Dict], question: str, chat_history: List[Dict], retrieval_rounds: int) -> bool:
    """Decide if one LLM-guided retrieval retry is worth it."""
    if retrieval_rounds >= 1:
        return False
    if not documents:
        return True
    if is_compare_intent(question) and len(documents) < 2:
        return True
    if chat_history and re.search(r"\b(that|it|those|what i said|the thing i|remember when)\b", question.lower()):
        if len(documents) < 3:
            return True
    return False


def extract_location(question: str) -> Optional[str]:
    match = re.search(
        r"\b(?:in|at|from|while in)\s+([A-Za-z][A-Za-z\s]{1,30}?)(?:\?|,|\.|$|\s+(?:when|what|how|did|do|have|i\s))",
        question,
        re.I,
    )
    if match:
        loc = match.group(1).strip()
        if len(loc) > 2:
            return loc
    return None


def route_tools(question: str) -> Dict[str, Any]:
    """Heuristic tool router — no LLM call."""
    q = question.lower()
    tools: List[Dict] = []

    needs_computation = bool(
        re.search(r"\b(total|how much|add up|spent|spending|average|avg)\b", q)
        or (re.search(r"\bhow many\b", q) and re.search(r"\b(times|spent|mentioned|wrote)\b", q))
    )

    computation_operation = "sum"
    if "average" in q or "avg" in q:
        computation_operation = "average"
    elif re.search(r"\b(count|how many)\b", q):
        computation_operation = "count"
    elif re.search(r"\b(min|least|lowest|smallest)\b", q):
        computation_operation = "min"
    elif re.search(r"\b(max|most|highest|largest)\b", q):
        computation_operation = "max"

    date_range = parse_date_range(question)
    compare_periods = parse_compare_periods(question)
    location = extract_location(question)
    recent = bool(re.search(r"\b(lately|recently|last few|these days|what have i written|what have i been)\b", q))

    if compare_periods:
        for period in compare_periods:
            tools.append({"name": "search_journal_by_date_range", "args": {**period, "query": question}})
    elif date_range:
        tools.append({"name": "search_journal_by_date_range", "args": {**date_range, "query": question}})
    elif recent:
        tools.append({"name": "get_recent_entries", "args": {"limit": 10}})

    if location:
        tools.append({"name": "search_by_location", "args": {"location": location}})

    if not tools or needs_computation:
        tools.append({"name": "search_journal_semantic", "args": {"query": question}})

    return {
        "tools": tools,
        "needs_computation": needs_computation,
        "computation_operation": computation_operation,
    }


def search_journal_semantic(query: str, user_id: str, token: str) -> List[Dict]:
    english_query = translate_to_english(query)
    query_embedding = generate_query_embedding(english_query)
    client = _client(token)
    match_res = client.rpc(
        "match_entry_vectors",
        {
            "query_embedding": query_embedding,
            "match_threshold": 0.35,
            "match_count": 10,
            "p_user_id": user_id,
        },
    ).execute()

    documents = []
    seen = set()
    if match_res.data:
        for d in match_res.data:
            entry_id = d.get("entry_id")
            full_content = (d.get("full_content") or "").strip()
            if full_content and entry_id not in seen:
                documents.append(
                    {
                        "chunk_content": full_content,
                        "entry_id": entry_id,
                        "full_content": full_content,
                        "created_at": d.get("created_at"),
                        "location": d.get("location"),
                    }
                )
                seen.add(entry_id)
    return documents


def search_journal_by_date_range(
    start_date: str,
    end_date: str,
    user_id: str,
    token: str,
    query: Optional[str] = None,
) -> List[Dict]:
    client = _client(token)
    res = (
        client.table("entries")
        .select("id, content, created_at, location, english_translation")
        .eq("user_id", user_id)
        .gte("created_at", start_date)
        .lte("created_at", end_date)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    documents = [_entry_to_doc(e) for e in (res.data or [])]

    if query and documents:
        semantic = search_journal_semantic(query, user_id, token)
        semantic_ids = {d["entry_id"] for d in semantic}
        documents = [d for d in documents if d["entry_id"] in semantic_ids] or documents

    return documents


def get_recent_entries(limit: int, user_id: str, token: str) -> List[Dict]:
    limit = max(1, min(int(limit), 20))
    client = _client(token)
    res = (
        client.table("entries")
        .select("id, content, created_at, location, english_translation")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [_entry_to_doc(e) for e in (res.data or [])]


def search_by_location(location: str, user_id: str, token: str) -> List[Dict]:
    client = _client(token)
    res = (
        client.table("entries")
        .select("id, content, created_at, location, english_translation")
        .eq("user_id", user_id)
        .ilike("location", f"%{location}%")
        .order("created_at", desc=True)
        .limit(15)
        .execute()
    )
    return [_entry_to_doc(e) for e in (res.data or [])]


def compute_from_memories(
    operation: str,
    values: List[Dict[str, Any]],
    allowed_entry_ids: Set[str],
    label: str = "",
) -> Dict[str, Any]:
    valid_ops = {"sum", "average", "min", "max", "count"}
    if operation not in valid_ops:
        return {"success": False, "reason": "invalid_operation"}

    if not values:
        return {"success": False, "reason": "no_numbers_in_context"}

    validated = []
    for v in values:
        entry_id = str(v.get("source_entry_id", ""))
        if entry_id not in allowed_entry_ids:
            return {"success": False, "reason": "invalid_source", "entry_id": entry_id}
        try:
            num = float(v["value"])
        except (KeyError, TypeError, ValueError):
            continue
        validated.append(
            {"value": num, "source_entry_id": entry_id, "excerpt": v.get("excerpt", "")}
        )

    if not validated:
        return {"success": False, "reason": "no_numbers_in_context"}

    nums = [v["value"] for v in validated]
    if operation == "sum":
        result = sum(nums)
    elif operation == "average":
        result = sum(nums) / len(nums)
    elif operation == "min":
        result = min(nums)
    elif operation == "max":
        result = max(nums)
    elif operation == "count":
        result = float(len(validated))
    else:
        return {"success": False, "reason": "invalid_operation"}

    return {
        "success": True,
        "operation": operation,
        "result": result,
        "label": label,
        "sources": validated,
        "source_count": len(validated),
    }


def execute_tool_plan(tools: List[Dict], user_id: str, token: str) -> List[Dict]:
    documents: List[Dict] = []
    for tool in tools:
        name = tool.get("name", "")
        args = tool.get("args") or {}
        try:
            if name == "search_journal_semantic":
                docs = search_journal_semantic(args.get("query", ""), user_id, token)
            elif name == "search_journal_by_date_range":
                docs = search_journal_by_date_range(
                    args.get("start_date", ""),
                    args.get("end_date", ""),
                    user_id,
                    token,
                    args.get("query"),
                )
            elif name == "get_recent_entries":
                docs = get_recent_entries(args.get("limit", 10), user_id, token)
            elif name == "search_by_location":
                docs = search_by_location(args.get("location", ""), user_id, token)
            else:
                continue
            documents = merge_documents(documents, docs)
        except Exception as e:
            print(f"Tool {name} failed: {e}")
    return documents
