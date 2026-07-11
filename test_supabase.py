import sys
sys.path.append('backend')
from backend.services.ai import chunk_text, generate_embeddings
from core.deps import gemini_client

print(type(gemini_client))

