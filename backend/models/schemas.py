from pydantic import BaseModel
from typing import Optional

class EntryCreate(BaseModel):
    content: str
    location: Optional[str] = None

class EntryUpdate(BaseModel):
    content: str

class ChatRequest(BaseModel):
    query: str
    chat_history: list[dict] = []
