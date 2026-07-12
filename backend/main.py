from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import google.generativeai as genai
import os
from core.deps import GEMINI_API_KEY
from routers import entries, chat

app = FastAPI()

# Allow CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(entries.router)
app.include_router(chat.router)

@app.get("/api/probe")
def probe_models():
    genai.configure(api_key=GEMINI_API_KEY)
    supported_models = []
    try:
        for m in genai.list_models():
            supported_models.append({
                "name": m.name,
                "version": m.version,
                "supported_methods": m.supported_generation_methods
            })
        return {"models": supported_models}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
