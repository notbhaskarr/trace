from fastapi import APIRouter, Depends, HTTPException
from core.deps import get_current_user, supabase
from models.schemas import ChatRequest
from services.ai import generate_query_embedding, generate_chat_response

router = APIRouter()

@router.post("/api/chat")
def chat_doobie(req: ChatRequest, user=Depends(get_current_user)):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
        
    try:
        # 1. Embed query
        query_embedding = generate_query_embedding(req.query)
        
        # 2. Match vectors
        match_res = supabase.rpc("match_entry_vectors", {
            "query_embedding": query_embedding,
            "match_threshold": 0.15,
            "match_count": 10,
            "user_id_param": user.id
        }).execute()
        
        if not match_res.data or len(match_res.data) == 0:
            return {"answer": "I couldn't find any memories related to that.", "context": []}
            
        context_data = match_res.data
        context_text = "\\n\\n".join([f"- {c['content']}" for c in context_data])
        
        # 3. Chat with Gemini 1.5
        answer = generate_chat_response(req.query, context_text)
        
        return {
            "answer": answer,
            "context": [{"id": c["id"], "content": c["content"]} for c in context_data]
        }
        
    except Exception as e:
        print(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail="Doobie encountered an error")
