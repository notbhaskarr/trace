from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from google import genai
import os
import re
from typing import List, Optional
from dotenv import load_dotenv

# Load env variables from the root Next.js .env.local file
load_dotenv(dotenv_path="../.env.local")

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase environment variables.")
if not GEMINI_API_KEY:
    raise ValueError("Missing GEMINI_API_KEY environment variable.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
# Initialize the official Gemini SDK
gemini_client = genai.Client(api_key=GEMINI_API_KEY)

app = FastAPI()

# Allow CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://letsgetitdone.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication Dependency
def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    
    token = authorization.split(" ")[1]
    
    # We use Supabase to verify the JWT
    res = supabase.auth.get_user(token)
    if not res or not res.user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    return res.user

# Context-Aware Chunking (Sliding Window)
def chunk_text(text: str, max_chunk_size: int = 300, overlap: int = 50) -> List[str]:
    chunks = []
    # Split by sentences (very naive split for MVP, but better than pure character splits)
    sentences = re.split(r'(?<=[.?!])\s+', text)
    
    current_chunk = ""
    for sentence in sentences:
        if len(current_chunk) + len(sentence) < max_chunk_size:
            current_chunk += (current_chunk and " ") + sentence
        else:
            if current_chunk:
                chunks.append(current_chunk)
            # Start new chunk with overlap (take the last N chars from the previous chunk)
            overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
            current_chunk = overlap_text + " " + sentence if overlap_text else sentence
            
    if current_chunk:
        chunks.append(current_chunk)
        
    return [c.strip() for c in chunks if c.strip()]

# Pydantic Models
class EntryCreate(BaseModel):
    content: str
    location: Optional[str] = None

class EntryUpdate(BaseModel):
    content: str

class ChatRequest(BaseModel):
    query: str

@app.get("/api/entries")
def get_entries(user=Depends(get_current_user)):
    res = supabase.table("entries").select("id, content, created_at, location").eq("user_id", user.id).order("created_at", desc=True).execute()
    
    entries = []
    for entry in res.data:
        entries.append({
            "id": entry["id"],
            "content": entry["content"],
            "location": entry["location"],
            "created_at": entry["created_at"]
        })
    return entries

@app.post("/api/entries")
def create_entry(entry: EntryCreate, user=Depends(get_current_user)):
    if not entry.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")
        
    # 1. Save Raw Entry
    res = supabase.table("entries").insert({
        "user_id": user.id,
        "content": entry.content,
        "location": entry.location
    }).execute()
    
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to save entry")
        
    new_entry = res.data[0]
    
    # 2. Chunk and Vectorize
    chunks = chunk_text(entry.content)
    if chunks:
        # Prepend metadata to the chunk string
        enriched_chunks = [f"[Journal Entry] {c}" for c in chunks]
        try:
            # Generate Gemini embeddings
            embed_res = gemini_client.models.embed_content(
                model="text-embedding-004",
                contents=enriched_chunks
            )
            
            embeddings = embed_res.embeddings
            
            # Save vectors
            vector_rows = []
            for i, emb in enumerate(embeddings):
                vector_rows.append({
                    "entry_id": new_entry["id"],
                    "user_id": user.id,
                    "embedding": emb.values
                })
                
            supabase.table("entry_vectors").insert(vector_rows).execute()
        except Exception as e:
            print(f"Failed to generate embeddings: {e}")
            
    return {"success": True, "id": new_entry["id"]}

@app.put("/api/entries/{entry_id}")
def update_entry(entry_id: str, entry: EntryUpdate, user=Depends(get_current_user)):
    # 1. Update the raw entry
    supabase.table("entries").update({"content": entry.content}).eq("id", entry_id).eq("user_id", user.id).execute()
    
    # 2. Delete old vectors
    supabase.table("entry_vectors").delete().eq("entry_id", entry_id).eq("user_id", user.id).execute()
    
    # 3. Generate new chunks and embeddings
    chunks = chunk_text(entry.content)
    if chunks:
        enriched_chunks = [f"[Journal Entry] {c}" for c in chunks]
        try:
            embed_res = gemini_client.models.embed_content(
                model="text-embedding-004",
                contents=enriched_chunks
            )
            embeddings = embed_res.embeddings
            vector_rows = []
            for i, emb in enumerate(embeddings):
                vector_rows.append({
                    "entry_id": entry_id,
                    "user_id": user.id,
                    "embedding": emb.values
                })
            supabase.table("entry_vectors").insert(vector_rows).execute()
        except Exception as e:
            print(f"Failed to update embeddings: {e}")
            
    return {"success": True}

@app.delete("/api/entries/{entry_id}")
def delete_entry(entry_id: str, user=Depends(get_current_user)):
    supabase.table("entry_vectors").delete().eq("entry_id", entry_id).eq("user_id", user.id).execute()
    supabase.table("entries").delete().eq("id", entry_id).eq("user_id", user.id).execute()
    return {"success": True}

@app.post("/api/chat")
def chat_doobie(req: ChatRequest, user=Depends(get_current_user)):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
        
    try:
        # 1. Embed query
        embed_res = gemini_client.models.embed_content(
            model="text-embedding-004",
            contents=req.query
        )
        query_embedding = embed_res.embeddings[0].values
        
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
        prompt = f"You are Doobie, an AI journal assistant. You answer questions based ONLY on the user's past journal entries provided in the context below. If the context does not contain the answer, say you don't know based on their journals. Be concise, reflective, and conversational. \\n\\nContext:\\n{context_text}\\n\\nUser query: {req.query}"
        
        chat_res = gemini_client.models.generate_content(
            model="gemini-1.5-pro",
            contents=prompt,
        )
        
        return {
            "answer": chat_res.text,
            "context": [{"id": c["id"], "content": c["content"]} for c in context_data]
        }
        
    except Exception as e:
        print(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail="Doobie encountered an error")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
