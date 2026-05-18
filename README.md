# SURI — Adaptive Mathematics Learning

An adaptive mathematics learning web application for Philippine Junior High School students. SURI diagnoses prerequisite gaps, delivers targeted instruction, and guides mastery through a prerequisite learning graph.

## Project Structure

```
suri/
├── frontend/              # Next.js 14 App Router (TypeScript + Tailwind)
├── backend/               # FastAPI Python API server
├── knowledge_base/        # DepEd SLM PDF storage and index builder
├── mathsteps_runner/      # Node.js subprocess for step-by-step math solving
└── README.md
```

## Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **npm**

## Setup

### 1. Install Python dependencies

```bash
pip install -r backend/requirements.txt
```

### 2. Install Node.js dependencies for mathsteps

```bash
cd mathsteps_runner
npm install
cd ..
```

### 3. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

### 4. Build the knowledge base index

Place DepEd SLM PDF files in `knowledge_base/slm_pdfs/`, then run:

```bash
python knowledge_base/build_index.py
```

### 5. Set environment variables

Create a `.env` file in the project root or export these variables:

| Variable        | Description                          | Default                  |
| --------------- | ------------------------------------ | ------------------------ |
| `GEMINI_API_KEY` | Google Gemini API key for LLM calls | *(required)*             |
| `JWT_SECRET`    | Secret key for signing JWT tokens    | `dev-secret-change-in-production` |
| `DATABASE_URL`  | SQLite database file path            | `suri.db`                |

### 6. Start the FastAPI backend

```bash
uvicorn backend.main:app --reload
```

The API will be available at `http://localhost:8000`.

### 7. Start the Next.js frontend

```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:3000`.

## API Endpoints

### Auth
- `POST /api/auth/register` — Register a new student
- `POST /api/auth/login` — Log in with name and password

### Topics
- `GET /api/topics` — List all entry topics
- `GET /api/topics/{node_id}/intro` — Get topic introduction

### Sessions
- `POST /api/sessions` — Create a learning session
- `GET /api/sessions/{session_id}` — Get session details
- `PATCH /api/sessions/{session_id}` — Update session state
- `PATCH /api/sessions/{session_id}/progress` — Update session progress

### Diagnostic
- `GET /api/diagnostic/{session_id}/probe` — Get next diagnostic probe
- `POST /api/diagnostic/{session_id}/answer` — Submit diagnostic answer

### Content
- `POST /api/content/generate` — Generate lesson content for a node

### Practice
- `POST /api/practice/start` — Start a practice problem set
- `POST /api/practice/submit-step` — Submit a step in a practice problem

### Progression
- `POST /api/progression/decide` — Decide advance or remediate

### Student
- `GET /api/students/{student_id}/progress` — Get student progress

## Learning Graph

The prerequisite learning graph is defined in `backend/graph.py`. It contains 16 math topic nodes organized into 4 chains spanning Grades 6–10. Entry nodes are: **QE** (Quadratic Equations), **SLE** (Systems of Linear Equations), **RER** (Rational Exponents & Radicals), **PE** (Polynomial Equations).
