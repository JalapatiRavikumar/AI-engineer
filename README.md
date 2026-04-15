# Medical Research Assistant (MERN + Open-Source LLM)

Production-ready **AI-powered Medical Research Assistant** built with the **MERN stack** and a **local open-source LLM (Ollama)**.  
It expands medical queries, retrieves large-scale research results (PubMed + OpenAlex + ClinicalTrials.gov), ranks them, and generates **grounded structured answers with sources**.

## What this app does

- **Accepts structured + natural queries** (patient name, disease/condition, question, location)
- **Query expansion** (disease-aware boolean query + variations)
- **Retrieves research at scale**
  - OpenAlex: **50–100 works**
  - PubMed (esearch → efetch): **50–100 records**
  - ClinicalTrials.gov: **20–50 trials**
- **Normalizes** all records into a single format
- **Ranks** results using weighted scoring  
  \[
  score = 0.4 \times relevance + 0.3 \times recency + 0.3 \times keywordMatch
  \]
  plus source credibility weighting
- **LLM synthesis (Ollama)** using **ONLY retrieved data** (no hallucination by design prompt)
- **Multi-turn sessions** stored in MongoDB (chat history + disease context)
- **UI**: clean medical theme, card-based, responsive chat, loading state (“Analyzing research…”)

## Tech stack

### Backend
- Node.js, Express
- MongoDB + Mongoose
- Axios (API calls)
- Ollama (local LLM)

### Frontend
- React (Vite)
- Tailwind CSS v4
- Axios

## Repository structure

```
.
├─ backend/
│  ├─ controllers/
│  ├─ models/
│  ├─ routes/
│  ├─ services/
│  ├─ utils/
│  ├─ app.js
│  └─ server.js
└─ frontend/
   ├─ src/
   └─ vite.config.js
```

## Quick start (local)

### 1) Prerequisites
- **Node.js 18+**
- **MongoDB** (local or Atlas)
- **Ollama** installed and running (`http://127.0.0.1:11434`)

Pull a model (recommended):

```bash
ollama pull mistral
# or
ollama pull llama3
```

### 2) Backend setup

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Backend default: `http://127.0.0.1:5000`

### 3) Frontend setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend default: `http://127.0.0.1:5173`

> Dev convenience: the frontend proxies `/api` → `http://127.0.0.1:5000`.

## Environment variables

### Backend (`backend/.env`)

Required:
- `MONGODB_URI` (MongoDB connection string)
- `OLLAMA_BASE_URL` (default `http://127.0.0.1:11434`)
- `OLLAMA_MODEL` (e.g. `mistral`, `llama3`)

Optional:
- `PORT` (default `5000`)
- `CORS_ORIGIN` (set to your deployed frontend URL for production)

> Do **not** commit secrets. `backend/.env` is ignored by git.

### Frontend (`frontend/.env`)

Optional:
- `VITE_API_URL`  
  - **Unset for local dev** (uses proxy)
  - **Set in production** to your deployed backend base URL (no trailing slash)

## API

### POST `/api/research`

**Request body**

```json
{
  "patientName": "Optional",
  "disease": "Parkinson's disease",
  "query": "deep brain stimulation",
  "location": "Boston, USA",
  "sessionId": "optional-session-id"
}
```

**Response (high level)**
- `structuredAnswer`: grounded LLM output with required sections
- `researchPapers`: top ranked publications (6–8)
- `clinicalTrials`: top ranked trials (3–5)
- `sources`: list of sources (papers + trials)
- `sessionId`: persisted session id
- `expansion`: expansion summary
- `stats`: counts only (no raw API dumps)

### GET `/api/session/:sessionId`
Returns saved session context and chat history from MongoDB.

## Ranking details

Signals:
- **Keyword match**: query token overlap in title/abstract
- **Disease relevance**: disease token overlap in title/abstract
- **Recency**: year mapped to 0–1 (recent = higher)
- **Source credibility**: PubMed > OpenAlex

Output:
- Publications: keep **top 8**
- Trials: keep **top 5**

## Grounding and safety

The model is instructed to:
- **Use ONLY retrieved data**
- **Avoid inventing** studies, outcomes, authors, or claims
- **Admit uncertainty** when data is insufficient

This is a **research assistant**, not a medical diagnosis tool.

## Demo queries

- “Latest treatment for lung cancer”
- “Clinical trials for diabetes”
- “Vitamin D for cancer patients”

## Deployment

### Backend (Render / Railway)
1. Create a new service from `backend/`
2. Set env vars:
   - `MONGODB_URI`
   - `OLLAMA_BASE_URL` (if using a hosted Ollama instance)  
     *Note:* Most cloud providers won’t let you call your **local** Ollama. For production, deploy Ollama where the backend can reach it.
   - `OLLAMA_MODEL`
   - `CORS_ORIGIN` (your frontend URL)
3. Start command: `npm start`

### Frontend (Vercel / Netlify)
1. Build from `frontend/`
2. Set env var:
   - `VITE_API_URL` = your backend base URL

### MongoDB
- Use MongoDB Atlas for production

## Notes / next upgrades (optional)
- Add **embeddings** + semantic retrieval (FAISS/Chroma) for better recall
- Add UI filters (year, author, source)
- Add citation-level snippet extraction and highlighting per claim
