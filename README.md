# Hedge — Trust-Aware AI Agent (Confidence Estimation)

A full-stack web application that answers user questions, estimates its own confidence using two measurable signals (**Semantic Consistency** and **Evidence Grounding**), routes its behavior based on that confidence score, and visually presents explainability timelines and evidence drawers.

---

## Features

- **Query Classification**: Classifies incoming queries into `factual`, `creative`, or `ambiguous` via LLM few-shot prompt routing.
- **Dual-Signal Confidence Estimation**:
  - **Signal 1 — Semantic Consistency**: Samples answers multiple times at temperature 0.7, computes sentence embeddings via `sentence-transformers` (`all-MiniLM-L6-v2`), and measures mean pairwise cosine similarity.
  - **Signal 2 — Evidence Grounding**: Executes Tavily web searches, breaks the generated answer into claims, and verifies term presence in search snippets.
  - **Fused Score**: `confidence = 0.5 * consistency_score + 0.5 * grounding_score`.
- **Behavioral Routing**:
  - **High Confidence ($\ge 0.8$)**: Answers directly with Green badge & evidence panel.
  - **Moderate Confidence ($0.4 - 0.79$)**: Answers with caveat noting mixed evidence + Yellow badge & evidence panel.
  - **Low Confidence ($< 0.4$)**: Refuses answer with reason and suggested next step + Red badge.
  - **Ambiguous Queries**: Returns clarifying questions without confidence badges.
  - **Creative Queries**: Answers directly with full confidence and no search verification.
- **Explainability Timeline**: Visualizes `initial` (consistency), `after_search` (grounding), and `final` (fused) confidence progression.

---

## Project Structure

```
hedge/
├── backend/
│   ├── main.py              # FastAPI app, single /api/query endpoint
│   ├── requirements.txt
│   ├── .env.example         # Environment template
│   └── .env                 # API Keys
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # Single-page chat UI with timeline & evidence drawer
│   │   ├── main.tsx
│   │   └── index.css         # Styling system
│   ├── package.json
│   ├── vite.config.ts
│   └── index.html
└── README.md                 # Setup instructions + Scope & Limitations
```

---

## Setup & Running Locally

### Prerequisites
- Python 3.10+
- Node.js v18+ & npm

### 1. Environment Configuration

#### Setting up your API keys
> [!IMPORTANT]
> **Understanding `.env` vs `.env.example`**:
> - `backend/.env.example`: A template file containing **placeholder values only**. This file is committed to git repository history. **Do NOT put real API keys in `.env.example`.**
> - `backend/.env`: The local environment file where your **REAL private API keys** belong. This file is listed in `.gitignore` and is **NEVER committed to git**.

To set up your local environment:
1. Copy `.env.example` to `.env` inside `backend/`:
   - **Linux/macOS (bash/zsh)**:
     ```bash
     cp backend/.env.example backend/.env
     ```
   - **Windows (PowerShell / Command Prompt)**:
     ```cmd
     copy backend\.env.example backend\.env
     ```
2. Open `backend/.env` and replace the placeholder values with your real API keys:
   ```env
   GROQ_API_KEY=your_actual_groq_api_key
   TAVILY_API_KEY=your_actual_tavily_api_key
   # OPENAI_API_KEY=your_actual_openai_api_key (optional alternative)
   ```
   *(Note: Get a free Groq API key at [console.groq.com](https://console.groq.com). If `GROQ_API_KEY` is missing, Hedge returns an honest Service Unavailable state. To explicitly run offline demo mode, set `DEMO_MODE=true` in `backend/.env`).*

### 2. Backend Setup
```bash
cd backend
python -m venv venv
# On Windows PowerShell:
venv\Scripts\Activate.ps1
# On Linux/macOS:
# source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
Backend runs at: `http://localhost:8000`

### 3. Frontend Setup
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at: `http://localhost:3000`

> [!NOTE]
> **Frontend Port Management & `strictPort`**:
> - `frontend/vite.config.ts` is configured with `strictPort: true`.
> - If port `3000` is already occupied by a stale frontend process, Vite will **fail explicitly** with an error (rather than silently auto-incrementing to `3001` or `3002`).
> - If you receive a port error when starting the frontend, close any duplicate/stale terminal windows running Vite or terminate processes occupying port 3000 before running `npm run dev`.

---

## Scope & Limitations

> [!IMPORTANT]
> Please read the following scope and theoretical limitations carefully:
>
> 1. **Confidence scores are not calibrated probabilities**: A score of `0.8` does not represent an $80\%$ empirical probability of objective correctness. It is a heuristic fused signal.
> 2. **Integration of prior research**: This project implements a simplified, hackathon-scoped integration of ideas from semantic entropy research (*Farquhar et al., Nature, 2024*) and evidence-grounding techniques. It is an engineering integration, not a novel theoretical contribution.
> 3. **Honest failure handling over silent fallbacks**: If the configured LLM provider (Groq) is unreachable, out of quota, or misconfigured, Hedge returns an explicit "Service Unavailable" error state rather than a fabricated response to avoid presenting unverified output as real reasoned answer.
> 4. **Client-side session history & identity**: Session threads and display names reside exclusively in browser `localStorage` scoped to a random session ID. There is no backend database or user authentication, so history will not sync across devices or persist if browser storage is cleared.
> 5. **No formal benchmark evaluation**: No formal benchmark datasets (e.g., SimpleQA, TriviaQA, TruthfulQA) were evaluated for calibration error or accuracy metrics. The confidence signals are simplified implementations and have not been validated against a held-out test set with known ground truth.
> 6. **Hackathon-scoped prototype**: Capabilities such as multi-agent orchestration, formal calibration modeling, real user authentication, and a persistent backend database were intentionally deferred to keep the build achievable within the project timeline.
