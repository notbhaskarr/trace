from typing import List
from core.deps import gemini_client
from langchain_text_splitters import RecursiveCharacterTextSplitter

def chunk_text(text: str, max_chunk_size: int = 300, overlap: int = 50) -> List[str]:
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=max_chunk_size,
        chunk_overlap=overlap,
        length_function=len,
        is_separator_regex=False,
    )
    return text_splitter.split_text(text)

def generate_embeddings(chunks: List[str]):
    enriched_chunks = [f"[Journal Entry] {c}" for c in chunks]
    embed_res = gemini_client.models.embed_content(
        model="embedding-001",
        contents=enriched_chunks
    )
    return embed_res.embeddings

def generate_query_embedding(query: str):
    embed_res = gemini_client.models.embed_content(
        model="embedding-001",
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
