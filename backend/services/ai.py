import re
from typing import List
from core.deps import gemini_client

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

def generate_embeddings(chunks: List[str]):
    enriched_chunks = [f"[Journal Entry] {c}" for c in chunks]
    embed_res = gemini_client.models.embed_content(
        model="text-embedding-004",
        contents=enriched_chunks
    )
    return embed_res.embeddings

def generate_query_embedding(query: str):
    embed_res = gemini_client.models.embed_content(
        model="text-embedding-004",
        contents=query
    )
    return embed_res.embeddings[0].values

def generate_chat_response(query: str, context_text: str):
    prompt = f"You are Doobie, an AI journal assistant. You answer questions based ONLY on the user's past journal entries provided in the context below. If the context does not contain the answer, say you don't know based on their journals. Be concise, reflective, and conversational. \\n\\nContext:\\n{context_text}\\n\\nUser query: {query}"
    
    chat_res = gemini_client.models.generate_content(
        model="gemini-1.5-pro",
        contents=prompt,
    )
    return chat_res.text
