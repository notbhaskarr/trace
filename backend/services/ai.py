from typing import List
from core.deps import GEMINI_API_KEY
from langchain_text_splitters import RecursiveCharacterTextSplitter
import requests

def chunk_text(text: str, max_chunk_size: int = 300, overlap: int = 50) -> List[str]:
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=max_chunk_size,
        chunk_overlap=overlap,
        length_function=len,
        is_separator_regex=False,
    )
    return text_splitter.split_text(text)

def generate_embeddings(chunks: List[str]):
    if not chunks:
        return []
        
    enriched_chunks = [f"[Journal Entry] {c}" for c in chunks]
    embeddings = []
    
    for text in enriched_chunks:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={GEMINI_API_KEY}"
        payload = {
            "model": "models/gemini-embedding-001",
            "content": {"parts": [{"text": text}]}
        }
        
        response = requests.post(url, json=payload)
        if not response.ok:
            raise Exception(f"API Error {response.status_code}: {response.text}")
            
        data = response.json()
        embeddings.append(data["embedding"]["values"])
        
    return embeddings

def generate_query_embedding(query: str):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={GEMINI_API_KEY}"
    payload = {
        "model": "models/gemini-embedding-001",
        "content": {"parts": [{"text": query}]}
    }
    
    response = requests.post(url, json=payload)
    if not response.ok:
        raise Exception(f"API Error {response.status_code}: {response.text}")
        
    data = response.json()
    return data["embedding"]["values"]


