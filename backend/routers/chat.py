from fastapi import APIRouter, Depends, HTTPException
from core.deps import get_current_user, get_auth_token
from models.schemas import ChatRequest
from services.graph import doobie_graph

router = APIRouter()

@router.post("/api/chat")
def chat_doobie(req: ChatRequest, user=Depends(get_current_user), token: str = Depends(get_auth_token)):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
        
    try:
        # Attempt to get a friendly name from metadata or email
        user_name = "my friend"
        if user.user_metadata:
            user_name = user.user_metadata.get("full_name") or user.user_metadata.get("name") or user_name
        elif user.email:
            user_name = user.email.split("@")[0]

        # Invoke the LangGraph workflow
        initial_state = {
            "question": req.query,
            "chat_history": req.chat_history,
            "user_id": user.id,
            "user_name": user_name,
            "token": token,
            "documents": [],
            "standalone_query": "",
            "answer": "",
            "attempts": 0,
            "judge_feedback": ""
        }
        
        # Run the graph
        final_state = doobie_graph.invoke(initial_state)
        
        return {
            "answer": final_state["answer"],
            "context": final_state["documents"]
        }
        
    except Exception as e:
        print(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail="Doobie encountered an error")
