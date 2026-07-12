# Pivot to FastEmbed for Bulletproof Embeddings

The persistent `404 Not Found` error for Gemini embeddings, despite using the correct SDK and model string, is a known edge-case bug with specific Google AI Studio projects where the internal routing for the `embedContent` method fails. Instead of fighting Google's API, we will pivot to a more efficient, self-hosted solution.

We will use **FastEmbed**, a lightweight, blazing-fast Python library that runs embedding generation locally on your Render server.

## Why FastEmbed?
1. **Zero External APIs:** It doesn't rely on Google, OpenAI, or Cohere. It runs completely locally.
2. **Lightning Fast:** It uses highly optimized ONNX runtimes.
3. **No PyTorch Required:** Unlike HuggingFace `sentence-transformers`, FastEmbed is extremely lightweight (needs < 150MB RAM) and will not crash your free Render instance.
4. **Efficiency:** It uses the `BAAI/bge-small-en-v1.5` model, which generates 384-dimension vectors. This is half the size of Gemini's vectors, meaning your Supabase database will be twice as fast and take up half the storage space.

## Proposed Changes

### Dependencies
#### [MODIFY] [requirements.txt](file:///Users/test/Projects/trace/backend/requirements.txt)
- Remove `langchain-google-genai`.
- Add `fastembed`.

### AI Service
#### [MODIFY] [ai.py](file:///Users/test/Projects/trace/backend/services/ai.py)
- Import `from fastembed import TextEmbedding`.
- Initialize `embeddings_model = TextEmbedding()`.
- Update `generate_embeddings` to use `list(embeddings_model.embed(chunks))`.
- For the Chat generation, we will revert back to the stable `google-generativeai` SDK directly for the LLM (which we know works fine since you haven't gotten errors for the chat generation).

### Database Migration
#### [NEW] [fastembed_migration.sql](file:///Users/test/Projects/trace/backend/scratch/fastembed_migration.sql)
Since FastEmbed uses 384-dimension vectors, we will need to execute a simple SQL command in your Supabase dashboard to shrink the `embedding` column from 768 down to 384.

```sql
-- Drop the existing vector column
ALTER TABLE entry_vectors DROP COLUMN embedding;
-- Recreate it with 384 dimensions
ALTER TABLE entry_vectors ADD COLUMN embedding vector(384);
```

## User Review Required
> [!IMPORTANT]
> Because we are switching the mathematical dimension size of the memories, you will need to run the short SQL script above in your Supabase SQL Editor. Are you comfortable proceeding with this local AI setup?
