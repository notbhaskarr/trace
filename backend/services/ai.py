from typing import List
from core.deps import GEMINI_API_KEY, SARVAM_API_KEY
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
    
    for i in range(0, len(enriched_chunks), 100):
        batch = enriched_chunks[i:i+100]
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key={GEMINI_API_KEY}"
        
        requests_payload = []
        for text in batch:
            requests_payload.append({
                "model": "models/gemini-embedding-001",
                "content": {"parts": [{"text": text}]}
            })
            
        payload = {
            "requests": requests_payload
        }
        
        response = requests.post(url, json=payload)
        if not response.ok:
            raise Exception(f"API Error {response.status_code}: {response.text}")
            
        data = response.json()
        # Parse the batch response array exactly right
        for item in data.get("embeddings", []):
            embeddings.append(item.get("values", []))
        
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

def translate_to_english(text: str) -> str:
    url = "https://api.sarvam.ai/translate"
    payload = {
        "input": text,
        "source_language_code": "hi-IN",
        "target_language_code": "en-IN",
        "speaker_gender": "Male",
        "mode": "formal",
        "model": "mayura:v1"
    }
    headers = {
        "api-subscription-key": SARVAM_API_KEY,
        "Content-Type": "application/json"
    }
    try:
        response = requests.post(url, json=payload, headers=headers)
        if not response.ok:
            print(f"Translation failed: {response.text}")
            return text
        data = response.json()
        return data.get("translated_text", text)
    except Exception as e:
        print(f"Translation exception: {e}")
        return text
