# Trace Codebase Deep Dive: Architecture & Data Flow

The Trace application is split into two entirely independent systems: a Next.js Frontend (the visual app) and a Python FastAPI Backend (the AI brain).

Here is a map of exactly where every feature lives, how they connect, and how data flows through the application.

---

## 1. The Frontend (Visuals & User Input)
Everything the user sees, clicks, or types lives inside the `src/` directory.

### The UI & Pages
- **[src/app/page.tsx](file:///Users/test/Projects/trace/src/app/page.tsx)**: This is the Dashboard Editor. It contains the large text area where you write your journal entries. When you hit "Leave a Trace", it sends a `POST` request to the backend. It no longer contains chat logic.
- **[src/app/timeline/page.tsx](file:///Users/test/Projects/trace/src/app/timeline/page.tsx)**: This is the Timeline Feed. It makes a `GET` request to fetch all your past entries and displays them in a scrollable list, allowing for updates or deletions.
- **[src/components/ChatProvider.tsx](file:///Users/test/Projects/trace/src/components/ChatProvider.tsx)**: This is the Global Chat Layout wrapper. It persists the Chat Sidebar state and history across all pages. It handles sending user messages to the backend and sliding the resizable sidebar in and out.
- **[src/components/Navbar.tsx](file:///Users/test/Projects/trace/src/components/Navbar.tsx)**: The top navigation bar. It dynamically determines its active links and triggers the global chat toggle.
- **[src/components/UserWidget.tsx](file:///Users/test/Projects/trace/src/components/UserWidget.tsx)**: Handles the Supabase authentication UI (Sign In / Sign Out).

### The "Glue"
- **[src/app/layout.tsx](file:///Users/test/Projects/trace/src/app/layout.tsx)**: The root wrapper of the app. It wraps the entire application in the `ChatProvider` to ensure chat memory is indestructible during page navigation.
- **[.env.local](file:///Users/test/Projects/trace/.env.local)**: The master configuration file holding Supabase URLs and `GEMINI_API_KEY`.
- **[src/middleware.ts](file:///Users/test/Projects/trace/src/middleware.ts)**: Runs on every page load to forcefully redirect unauthenticated users to the login screen.

---

## 2. The Backend (The AI & Database Factory)
The backend is a highly modular Python FastAPI application in the `backend/` directory. It receives requests from the frontend, does the heavy lifting, and talks to the Supabase database.

### The Entrypoint
- **[backend/main.py](file:///Users/test/Projects/trace/backend/main.py)**: Initializes the FastAPI server, enables CORS, and registers the API Routers.

### The API Routers (The Doormen)
Routers act as the entry doors for frontend requests, immediately handing data off to the Services.
- **[backend/routers/entries.py](file:///Users/test/Projects/trace/backend/routers/entries.py)**: Handles all Journal CRUD operations (`GET`, `POST`, `PUT`, `DELETE`). 
- **[backend/routers/chat.py](file:///Users/test/Projects/trace/backend/routers/chat.py)**: Receives the user's chat question and passes it into the LangGraph workflow (`doobie_graph.invoke()`).

### The Services & Models (The Brains)
This is where the actual AI logic and LLMs live.
- **[backend/services/ai.py](file:///Users/test/Projects/trace/backend/services/ai.py)**: Contains the LangChain `RecursiveCharacterTextSplitter`. Converts text into embeddings using Google's **`text-embedding-004`** model.
- **[backend/services/graph.py](file:///Users/test/Projects/trace/backend/services/graph.py)**: The LangGraph State Machine containing the Self-Reflective RAG loop (`retrieve`, `generate`, `evaluate_response`). 
  - **Generator Model**: Uses **`gemini-3.1-flash-lite`** (via `doobiesysprompt.txt`) to generate deeply insightful, empathetic responses.
  - **Judge Model**: Uses **`gemini-3.1-flash-lite`** (via `llmasjudgeprompt.txt`) to rapidly evaluate the Generator's response for hallucinations and filter out irrelevant citations.
- **[backend/core/deps.py](file:///Users/test/Projects/trace/backend/core/deps.py)**: Initializes Supabase and Gemini clients. Validates Supabase JWT tokens via `get_current_user`.
- **[backend/models/schemas.py](file:///Users/test/Projects/trace/backend/models/schemas.py)**: Uses Pydantic to strictly define and validate the data structures the API expects.

---

## 3. Test Data Flow Scenario

What exactly happens under the hood when you leave a trace and later ask Doobie about it?

### Phase 1: Leaving a Trace
1. **User Action**: You type "I visited the botanical gardens today and felt surprisingly at peace" into the Editor on the Dashboard and click "Leave a Trace".
2. **Frontend Request**: `src/app/page.tsx` captures this string and sends a `POST` request to `/api/entries` with your Supabase Auth token.
3. **Backend Router**: `backend/routers/entries.py` intercepts the request, verifies your token via `deps.py`, and saves the raw text directly to the `entries` table in Supabase.
4. **Vectorization**: `entries.py` immediately passes the text to `backend/services/ai.py`. 
   - The text is chunked if it's too long.
   - The `text-embedding-004` model mathematically converts the text into a dense array of floats (an embedding).
   - The embedding is saved to the `entry_vectors` table in Supabase, permanently linking it to the original entry ID.
5. **Success**: The backend returns a 200 OK. The frontend clears the text box.

### Phase 2: Asking Doobie a Question
1. **User Action**: You open the Chat Sidebar and ask, "Where did I go today?"
2. **Frontend Request**: `src/components/ChatProvider.tsx` sends a `POST` request to `/api/chat` with your query.
3. **Graph Initialization**: `backend/routers/chat.py` receives the query and starts the LangGraph State Machine in `backend/services/graph.py`.

### Phase 3: The Self-Reflective RAG Loop
1. **The `retrieve` Node**: 
   - The graph converts your query ("Where did I go today?") into a new vector using `text-embedding-004`.
   - It performs a cosine similarity search against the Supabase `entry_vectors` table.
   - The database returns the closest mathematical match: the botanical gardens entry.
   - The graph fetches the full parent entry and adds it to its internal memory state.
2. **The `generate` Node**: 
   - The graph passes your query, the retrieved botanical gardens text, and the `doobiesysprompt.txt` to the **`gemini-3.1-flash-lite`** model.
   - Doobie reads the context and generates an answer: *"You visited the botanical gardens today and found some peace there."*
3. **The `evaluate_response` Node**:
   - The graph pauses and passes Doobie's answer, your original query, and the context to the **`gemini-3.1-flash-lite`** Judge model (via `llmasjudgeprompt.txt`).
   - The fast Judge model checks: *Did Doobie hallucinate? Did he actually use the provided context?*
   - The Judge outputs a JSON score. It verifies that Doobie used the botanical gardens context and gives a passing grade.
   - It filters out any unused mathematical citations so the UI remains uncluttered.
4. **Graph Completion**: The graph exits the loop and returns Doobie's final validated answer and the exact filtered context chunks he used.

### Phase 4: Displaying the Answer
1. **Frontend Render**: `backend/routers/chat.py` sends the JSON response back to `ChatProvider.tsx`.
2. **Overlay Link**: The ChatProvider renders Doobie's text. Because the backend returned the exact `context` used, the UI generates a clickable `[OCT 14 ENTRY]` pill below the message.
3. **Read Mode**: If you click the pill, the `selectedEntry` state triggers the full-screen read-mode overlay in `ChatProvider.tsx`, allowing you to read the original botanical gardens trace in its entirety.
