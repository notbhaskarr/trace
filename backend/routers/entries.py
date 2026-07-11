from fastapi import APIRouter, Depends, HTTPException
from core.deps import get_current_user, supabase
from models.schemas import EntryCreate, EntryUpdate
from services.ai import chunk_text, generate_embeddings

router = APIRouter()

@router.get("/api/entries")
def get_entries(user=Depends(get_current_user)):
    res = supabase.table("entries").select("id, content, created_at").eq("user_id", user.id).order("created_at", desc=True).execute()
    
    entries = []
    for entry in res.data:
        entries.append({
            "id": entry["id"],
            "content": entry["content"],
            "created_at": entry["created_at"]
        })
    return entries

@router.post("/api/entries")
def create_entry(entry: EntryCreate, user=Depends(get_current_user)):
    if not entry.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")
        
    # 1. Save Raw Entry
    res = supabase.table("entries").insert({
        "user_id": user.id,
        "content": entry.content
    }).execute()
    
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to save entry")
        
    new_entry = res.data[0]
    
    # 2. Chunk and Vectorize
    chunks = chunk_text(entry.content)
    if chunks:
        try:
            embeddings = generate_embeddings(chunks)
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

@router.put("/api/entries/{entry_id}")
def update_entry(entry_id: str, entry: EntryUpdate, user=Depends(get_current_user)):
    # 1. Update the raw entry
    supabase.table("entries").update({"content": entry.content}).eq("id", entry_id).eq("user_id", user.id).execute()
    
    # 2. Delete old vectors
    supabase.table("entry_vectors").delete().eq("entry_id", entry_id).eq("user_id", user.id).execute()
    
    # 3. Generate new chunks and embeddings
    chunks = chunk_text(entry.content)
    if chunks:
        try:
            embeddings = generate_embeddings(chunks)
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

@router.delete("/api/entries/{entry_id}")
def delete_entry(entry_id: str, user=Depends(get_current_user)):
    supabase.table("entry_vectors").delete().eq("entry_id", entry_id).eq("user_id", user.id).execute()
    supabase.table("entries").delete().eq("id", entry_id).eq("user_id", user.id).execute()
    return {"success": True}
