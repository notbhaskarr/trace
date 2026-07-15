import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from core.deps import get_current_user, get_auth_token
from models.schemas import ChatRequest
from services.graph import doobie_graph, build_initial_state, stream_doobie_events

router = APIRouter()


def _resolve_user_name(user) -> str:
    if user.user_metadata:
        name = (
            user.user_metadata.get("first_name")
            or user.user_metadata.get("full_name")
            or user.user_metadata.get("name")
        )
        if name:
            return name
    if user.email:
        return user.email.split("@")[0]
    return "my friend"


@router.post("/api/chat")
def chat_doobie(req: ChatRequest, user=Depends(get_current_user), token: str = Depends(get_auth_token)):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    try:
        state = build_initial_state(
            req.query, req.chat_history, user.id, _resolve_user_name(user), token
        )
        final_state = doobie_graph.invoke(state)
        return {
            "answer": final_state["answer"],
            "context": final_state["documents"],
            "computation": final_state.get("computation_result"),
        }
    except Exception as e:
        print(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail="Doobie encountered an error")


@router.post("/api/chat/stream")
async def chat_stream(req: ChatRequest, user=Depends(get_current_user), token: str = Depends(get_auth_token)):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    state = build_initial_state(
        req.query, req.chat_history, user.id, _resolve_user_name(user), token
    )

    async def event_generator():
        async for event in stream_doobie_events(state):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
