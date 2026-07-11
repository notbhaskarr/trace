import json
from typing import TypedDict, List, Dict
from langgraph.graph import StateGraph, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from core.deps import GEMINI_API_KEY, supabase
from services.ai import generate_query_embedding

# Define the State
class GraphState(TypedDict):
    question: str
    user_id: str
    documents: List[Dict]
    answer: str

# Initialize the LLMs
# Using gemini-1.5-flash for the fast judge
judge_llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-flash",
    google_api_key=GEMINI_API_KEY,
    temperature=0.0
)
# Using gemini-1.5-pro for the final answer
chat_llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-pro",
    google_api_key=GEMINI_API_KEY,
    temperature=0.7
)

def retrieve(state: GraphState):
    """
    Retrieve documents from the vector database.
    """
    question = state["question"]
    user_id = state["user_id"]
    
    query_embedding = generate_query_embedding(question)
    
    match_res = supabase.rpc("match_entry_vectors", {
        "query_embedding": query_embedding,
        "match_threshold": 0.15,
        "match_count": 10,
        "user_id_param": user_id
    }).execute()
    
    documents = []
    if match_res.data:
        documents = match_res.data
        
    return {"documents": documents}

def grade_documents(state: GraphState):
    """
    Determines whether the retrieved documents are relevant to the question.
    """
    question = state["question"]
    documents = state["documents"]
    
    filtered_docs = []
    
    system = """You are a grader assessing relevance of a retrieved document to a user question.
    If the document contains keyword(s) or semantic meaning related to the user question, grade it as relevant.
    It does not need to be a stringent test. The goal is to filter out erroneous retrievals.
    Give a binary score 'yes' or 'no' score to indicate whether the document is relevant to the question.
    Provide the output in strict JSON format with a single key 'score' and no markdown formatting."""

    for d in documents:
        prompt = f"Retrieved document: \\n\\n {d['content']} \\n\\n User question: {question}"
        messages = [
            SystemMessage(content=system),
            HumanMessage(content=prompt)
        ]
        
        response = judge_llm.invoke(messages)
        # Parse JSON output manually since we asked for strict JSON
        try:
            # Clean response text just in case it has markdown ticks
            text = response.content.replace("```json", "").replace("```", "").strip()
            score_json = json.loads(text)
            grade = score_json.get("score", "no").lower()
            if grade == "yes":
                filtered_docs.append(d)
        except Exception as e:
            # Fallback to keep it if grading fails
            filtered_docs.append(d)
            
    return {"documents": filtered_docs}

def generate(state: GraphState):
    """
    Generate the final answer.
    """
    question = state["question"]
    documents = state["documents"]
    
    if not documents:
        return {"answer": "I couldn't find any memories related to that."}
        
    context_text = "\\n\\n".join([f"- {d['content']}" for d in documents])
    
    system = """You are Doobie, an AI journal assistant. You answer questions based ONLY on the user's past journal entries provided in the context below. If the context does not contain the answer, say you don't know based on their journals. Be concise, reflective, and conversational."""
    
    prompt = f"Context:\\n{context_text}\\n\\nUser query: {question}"
    
    messages = [
        SystemMessage(content=system),
        HumanMessage(content=prompt)
    ]
    
    response = chat_llm.invoke(messages)
    return {"answer": response.content}

# Compile Graph
workflow = StateGraph(GraphState)

workflow.add_node("retrieve", retrieve)
workflow.add_node("grade_documents", grade_documents)
workflow.add_node("generate", generate)

# Edges
workflow.set_entry_point("retrieve")
workflow.add_edge("retrieve", "grade_documents")
workflow.add_edge("grade_documents", "generate")
workflow.add_edge("generate", END)

doobie_graph = workflow.compile()
