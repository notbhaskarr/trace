from typing import List
import google.generativeai as genai
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
    embed_res = genai.embed_content(
        model="models/text-embedding-004",
        content=enriched_chunks,
        task_type="retrieval_document"
    )
    return embed_res['embedding']

def generate_query_embedding(query: str):
    embed_res = genai.embed_content(
        model="models/text-embedding-004",
        content=query,
        task_type="retrieval_query"
    )
    return embed_res['embedding']

def generate_chat_response(query: str, context_text: str):
    prompt = f"You are Doobie, an AI journal assistant. You answer questions based ONLY on the user's past journal entries provided in the context below. If the context does not contain the answer, say you don't know based on their journals. Be concise, reflective, and conversational. \n\nContext:\n{context_text}\n\nUser query: {query}"
    
    model = genai.GenerativeModel("gemini-1.5-pro")
    chat_res = model.generate_content(prompt)
    return chat_res.text
