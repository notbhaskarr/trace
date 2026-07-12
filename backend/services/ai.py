from typing import List
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from core.deps import GEMINI_API_KEY
from langchain_text_splitters import RecursiveCharacterTextSplitter

def chunk_text(text: str, max_chunk_size: int = 300, overlap: int = 50) -> List[str]:
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=max_chunk_size,
        chunk_overlap=overlap,
        length_function=len,
        is_separator_regex=False,
    )
    return text_splitter.split_text(text)

embeddings_model = GoogleGenerativeAIEmbeddings(
    model="models/text-embedding-004", 
    google_api_key=GEMINI_API_KEY
)

def generate_embeddings(chunks: List[str]):
    enriched_chunks = [f"[Journal Entry] {c}" for c in chunks]
    return embeddings_model.embed_documents(enriched_chunks)

def generate_query_embedding(query: str):
    return embeddings_model.embed_query(query)


