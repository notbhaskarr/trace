# Trace Codebase Deep Dive: Where Does Everything Live?

The Trace application is split into two entirely independent systems: a Next.js Frontend (the visual app) and a Python FastAPI Backend (the AI brain).

Here is a map of exactly where every feature lives and how they connect.

---

## 1. The Frontend (Visuals & User Input)
Everything the user sees, clicks, or types lives inside the `src/` directory.

### The UI & Pages
- **[src/app/page.tsx](file:///Users/test/Projects/trace/src/app/page.tsx)**: This is the main Editor. It contains the large text area where you write your journal entries, and the Doobie chat sidebar on the right. When you hit "Save" or "Chat", this file wraps up your text and sends a `fetch()` request over the internet to the backend.
- **[src/app/timeline/page.tsx](file:///Users/test/Projects/trace/src/app/timeline/page.tsx)**: This is the Feed. It makes a `GET` request to the backend to fetch all your past entries and displays them in a scrollable list. It also handles the "Delete" and "Update" buttons.
- **[src/components/UserWidget.tsx](file:///Users/test/Projects/trace/src/components/UserWidget.tsx)**: This small component handles the Supabase authentication UI (Sign In / Sign Out).

### The "Glue"
- **[.env.local](file:///Users/test/Projects/trace/.env.local)**: This is the master configuration file at the root of the project. It holds your Supabase URLs and your `GEMINI_API_KEY`. (It is ignored by GitHub for security).
- **[src/middleware.ts](file:///Users/test/Projects/trace/src/middleware.ts)**: This runs on every single page load. It checks if the user is logged into Supabase. If they aren't, it forcefully redirects them to the login screen.

---

## 2. The Backend (The AI & Database Factory)
The backend is a highly modular Python FastAPI application that lives in the `backend/` directory. It receives requests from the frontend, does the heavy lifting, and talks to the Supabase database.

### The Entrypoint
- **[backend/main.py](file:///Users/test/Projects/trace/backend/main.py)**: This is the absolute start of the backend. It initializes the FastAPI server, turns on CORS (allowing the frontend to talk to it), and registers the API "Routers".

### The API Routers (The Doormen)
Routers act as the entry doors for frontend requests. They receive the data, but they immediately hand it off to the "Services" to actually do the work.
- **[backend/routers/entries.py](file:///Users/test/Projects/trace/backend/routers/entries.py)**: Handles all Journal CRUD operations (`GET`, `POST`, `PUT`, `DELETE`). 
- **[backend/routers/chat.py](file:///Users/test/Projects/trace/backend/routers/chat.py)**: Receives the user's chat question. It takes the question and immediately passes it into the LangGraph workflow (`doobie_graph.invoke()`).

### The Services (The Brains)
This is where the actual AI logic lives.
- **[backend/services/ai.py](file:///Users/test/Projects/trace/backend/services/ai.py)**: This file contains the LangChain `RecursiveCharacterTextSplitter`. When you save a new journal entry, `entries.py` sends the text here to be mathematically chopped into overlapping chunks and converted into `text-embedding-004` vectors.
- **[backend/services/graph.py](file:///Users/test/Projects/trace/backend/services/graph.py)**: This is the LangGraph State Machine. This file contains the entire Self-Reflective RAG loop. It defines the `retrieve`, `generate`, and `evaluate_response` nodes. 
- **[backend/services/doobiesysprompt.txt](file:///Users/test/Projects/trace/backend/services/doobiesysprompt.txt)**: The custom system prompt that tells `gemini-1.5-pro` how to act like Doobie.
- **[backend/services/llmasjudgeprompt.txt](file:///Users/test/Projects/trace/backend/services/llmasjudgeprompt.txt)**: The custom system prompt that tells `gemini-1.5-flash` how to grade Doobie's answers.

### The Core & Models (The Plumbing)
- **[backend/core/deps.py](file:///Users/test/Projects/trace/backend/core/deps.py)**: "Deps" stands for Dependencies. This file initializes the Supabase client and the Gemini client using the keys from `.env.local`. It also contains the `get_current_user` function, which intercepts every API request and verifies that the Supabase JWT token is valid before letting the request through.
- **[backend/models/schemas.py](file:///Users/test/Projects/trace/backend/models/schemas.py)**: This file uses Pydantic to strictly define what data the API expects. For example, it defines that a `ChatRequest` *must* contain a string called `query`. If the frontend sends bad data, this file automatically throws an error.
