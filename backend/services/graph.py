import os
import json
from typing import TypedDict, List, Dict
from langgraph.graph import StateGraph, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from core.deps import GEMINI_API_KEY, SUPABASE_URL, SUPABASE_KEY
from supabase import create_client, ClientOptions
from services.ai import generate_query_embedding

# Load prompts
SERVICES_DIR = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(SERVICES_DIR, "doobiesysprompt.txt"), "r") as f:
    DOOBIE_SYSTEM_PROMPT = f.read()

with open(os.path.join(SERVICES_DIR, "llmasjudgeprompt.txt"), "r") as f:
    JUDGE_SYSTEM_PROMPT = f.read()

# Define the State
class GraphState(TypedDict):
    question: str
    user_id: str
    token: str
    documents: List[Dict]
    answer: str
    attempts: int
    judge_feedback: str

# Initialize the LLMs
judge_llm = ChatGoogleGenerativeAI(
    model="gemini-3.5-flash",
    google_api_key=GEMINI_API_KEY,
    temperature=0.0
)
chat_llm = ChatGoogleGenerativeAI(
    model="gemini-3.5-flash",
    google_api_key=GEMINI_API_KEY,
    temperature=0.7
)

def retrieve(state: GraphState):
    """
    Retrieve documents from the vector database.
    """
    question = state["question"]
    user_id = state["user_id"]
    token = state["token"]
    
    query_embedding = generate_query_embedding(question)
    
    user_client = create_client(SUPABASE_URL, SUPABASE_KEY, options=ClientOptions(headers={"Authorization": f"Bearer {token}"}))
    
    match_res = user_client.rpc("match_entry_vectors", {
        "query_embedding": query_embedding,
        "match_threshold": 0.35,
        "match_count": 10,
        "p_user_id": user_id
    }).execute()
    
    documents = []
    seen_content = set()
    if match_res.data:
        for d in match_res.data:
            content = d.get('content', '').strip()
            if content and content not in seen_content:
                documents.append(d)
                seen_content.add(content)
        
    return {"documents": documents, "attempts": state.get("attempts", 0), "judge_feedback": state.get("judge_feedback", "")}


def generate(state: GraphState):
    """
    Generate the final answer.
    """
    question = state["question"]
    documents = state["documents"]
    judge_feedback = state.get("judge_feedback", "")
    attempts = state.get("attempts", 0)
    
    context_text = ""
    if documents:
        context_text = "\\n\\n".join([f"- {d['content']}" for d in documents])
        
    # Construct the prompt using the loaded DOOBIE_SYSTEM_PROMPT
    system_content = DOOBIE_SYSTEM_PROMPT.replace("{context_text}", context_text).replace("{query}", question)
    
    if judge_feedback:
        system_content += f"\\n\\nWARNING - PREVIOUS ATTEMPT FAILED. FIX THIS: {judge_feedback}"
        
    messages = [
        SystemMessage(content=system_content),
        HumanMessage(content=question)
    ]
    
    response = chat_llm.invoke(messages)
    
    # Safely extract text in case the new model returns a list of blocks
    answer_text = response.content
    if isinstance(answer_text, list):
        extracted = []
        for part in answer_text:
            if isinstance(part, dict) and "text" in part:
                extracted.append(part["text"])
            elif isinstance(part, str):
                extracted.append(part)
        answer_text = " ".join(extracted) if extracted else str(answer_text)
    
    # Increment attempts
    return {"answer": answer_text, "attempts": attempts + 1}


def evaluate_response(state: GraphState):
    """
    Evaluates Doobie's generated response for faithfulness and safety.
    """
    question = state["question"]
    documents = state["documents"]
    answer = state["answer"]
    
    context_text = ""
    if documents:
        context_text = "\\n\\n".join([f"- {d['content']}" for d in documents])
        
    # Construct the prompt using the loaded JUDGE_SYSTEM_PROMPT
    system_content = JUDGE_SYSTEM_PROMPT.replace("{context_text}", context_text).replace("{query}", question).replace("{response}", answer)
    
    messages = [
        SystemMessage(content=system_content),
        HumanMessage(content="Please evaluate Doobie's response based on the criteria above and return the JSON score.")
    ]
    
    response = judge_llm.invoke(messages)
    
    feedback = ""
    try:
        # Clean response text just in case it has markdown ticks
        text = response.content.replace("```json", "").replace("```", "").strip()
        score_json = json.loads(text)
        
        faithfulness = score_json.get("faithfulness_score", 5)
        safety = str(score_json.get("safety_handling", "pass")).lower()
        
        if faithfulness <= 3 or safety == "fail":
            rationale = score_json.get("rationale", "Unknown failure.")
            hallucinations = score_json.get("hallucinated_claims", [])
            feedback = f"Failed criteria! Rationale: {rationale}. Hallucinations: {hallucinations}"
            print(f"JUDGE FAILED DOOBIE: {feedback}")
    except Exception as e:
        print(f"Judge parsing failed: {e}")
        # If the judge fails to parse, we pass the response to be safe and avoid loops
        pass
        
    return {"judge_feedback": feedback}


def check_score(state: GraphState):
    """
    Conditional edge router
    """
    feedback = state.get("judge_feedback", "")
    attempts = state.get("attempts", 0)
    
    if feedback and attempts < 2:
        return "regenerate"
    return "end"


# Compile Graph
workflow = StateGraph(GraphState)

workflow.add_node("retrieve", retrieve)
workflow.add_node("generate", generate)
workflow.add_node("evaluate_response", evaluate_response)

# Edges
workflow.set_entry_point("retrieve")
workflow.add_edge("retrieve", "generate")
workflow.add_edge("generate", "evaluate_response")

workflow.add_conditional_edges(
    "evaluate_response",
    check_score,
    {
        "regenerate": "generate",
        "end": END
    }
)

doobie_graph = workflow.compile()
