# SURI - System Workflow and Pipeline Context

This document provides a comprehensive overview of the SURI (Mathematics Learning Platform) system, including its technical stack, architecture, and various processing pipelines. It is designed to provide complete context for future development and integrations.

## 1. Technology Stack

### Frontend
- **Framework**: Next.js 16 (App Router) with React 19.
- **Styling**: Tailwind CSS 4; the dashboard is a three.js 3D world map.
- **State & Data Fetching**: Standard React Hooks (`useState`, `useEffect`) and custom typed API wrappers.

### Backend
- **Framework**: FastAPI (Python) served via Uvicorn.
- **Database**: Supabase (PostgreSQL), accessed asynchronously via `asyncpg` with a connection pool.
- **Authentication**: Custom JWT (JSON Web Token) implementation utilizing `python-jose` and `bcrypt` for password hashing.
- **AI**: `google-generativeai` (Gemini) at runtime for lesson simplification, standard-mode step feedback, and end-of-quiz feedback. `llama-index`, `chromadb`, `sentence-transformers`, and `mathsteps` are used only by the offline build scripts that pre-generate lessons and practice problems; mathsteps also powers the calculator (`/api/solve`).

---

## 2. Authentication Pipeline

The authentication system issues a JWT as an HTTP-only cookie. The token is also returned in the response body; the frontend keeps a copy and sends it as a Bearer token, and the backend accepts either.

1. **Registration** (`POST /api/auth/register`):
   - Accepts `name`, `email`, `grade_level`, and `password`.
   - Hashes the password using `bcrypt`.
   - Stores the student record in the database.
   - Generates a JWT (expiring in 7 days) and sets it as an `access_token` HTTP-only cookie.
2. **Login** (`POST /api/auth/login`):
   - Verifies credentials.
   - Re-issues the JWT via an HTTP-only cookie.
3. **Session Validation** (`GET /api/auth/me`):
   - Reads the HTTP-only cookie.
   - Returns the student ID and name.
   - Used heavily by frontend middleware and routing (e.g., the root `/` route automatically verifies this endpoint to direct users to `/dashboard` or `/login`).
4. **Logout** (`POST /api/auth/logout`):
   - Clears the `access_token` cookie.

---

## 3. Core Application Workflows

### A. Dashboard Workflow
- **Endpoint**: `/api/students/{student_id}/progress`
- **Behavior**: Retrieves the student's active sessions, completed sessions, and their misconception history.
- **UI Presentation**:
  - Displays progress bars for active topics (calculated via `completion_percentage`).
  - Lists completed learning tracks with options to "Review Again."
  - Provides a toggleable "Error History" log showing recent mistakes (misconceptions) the student made during practice.

### B. Topics Selection Workflow
- **Endpoint**: `/api/topics`
- **Behavior**: Retrieves all available entry-level competency nodes (learning tracks).
- **UI Presentation**: Grid layout of topics. Integrates with the progress endpoint to highlight which topics are active, completed, or unstarted.

---

## 4. Learning Session Pipeline

When a user engages with a topic, the system orchestrates a personalized learning flow through a "Session."

### Phase 1: Session Initialization
- **Action**: Creating a new session or resuming an active one.
- **Backend Flow**: Evaluates the competency graph (defined in `graph.py`). A topic is a "node" in a directed graph of prerequisites. The session tracks which nodes the user has mastered and which are currently in progress.

### Phase 2: Diagnostic Assessment
- **Purpose**: Find the first prerequisite the student has not mastered.
- **Action**: Starting at the deepest prerequisite of the chain, the system presents multiple-choice probes one at a time (`/api/diagnostic/{session_id}/probe`), drawn from the node's stored questions (16 standard probes, plus up to 8 challenge probes on the 14 learning-path nodes; see `knowledge_base/challenge/README.md`). Each node's 4 questions are 3 standard + 1 challenge (placed at a seeded random position), falling back to standard-only when a node has no challenge probes. Each node is shown as a battle: one enemy with 3 hearts, and the student has 2 hearts.
- **Evaluation** (`/api/diagnostic/{session_id}/answer`): a node is passed after 3 correct answers (3 of 4 = 75%) and failed after 2 wrong answers (3 of 4 can no longer be reached). A passed node moves up to the next node; the first failed node ends the diagnostic and becomes the gap. If every node is passed, no gap is found.
- **Results** (`/api/diagnostic/{session_id}/submit`): nodes below the gap are marked mastered, the gap and nodes above it unresolved. The results screen shows the path and a "Start Practice" button (or an "all Improved" summary when there is no gap).

### Phase 3: Lesson & Content Delivery
- **Action**: The user views educational content for the active gap node (`/api/content/{node_id}`).
- **Content Types**:
  - **Lesson Text**: The main instructional material.
  - **Worked Example**: A step-by-step breakdown.
  - **Guided Explanation**: Further context.
- **AI Integration**: If the student finds the lesson too difficult, they can trigger an AI simplification (`/api/content/{node_id}/simplify`). The backend uses the LLM to rewrite the text to be more accessible.

### Phase 4: Active Practice
- **Action**: After reading the lesson, the student picks "Let's Practice!" (standard step-by-step mode, `/api/practice/start`) or "Quiz Me!" (gamified quiz with timers, hints, and streaks, `/api/quiz/*`). 5 of the at least 10 stored problems for the node are sampled, as 3 standard + 2 challenge (`practice_problems.difficulty`; `backend/problem_sampling.py`), topping up from the other pool when a node has too few of one kind. Both modes read the same table. In quiz mode challenge steps get longer timers (90 s for `variable_identification`, 75 s for `algebra`, versus 60 s), computed by `step_timer_ms` in `quiz_routes.py` for both the countdown and the points.
- **Evaluation** (`/api/practice/submit-step`):
  - The student's **first** answer for each step is the one scored; retries do not change it. A problem passes only if every step was right on the first attempt.
  - **Misconception Detection**: the first wrong step of a problem is logged to the student's history and mapped to a graph node; Gemini writes a short feedback note for that step.
  - The completion screen lists each step with the student's answer, the correct answer, and where the reasoning broke down. In quiz mode the first wrong step of each problem is logged when the quiz finishes (`/api/quiz/finish`); a timed-out step counts as wrong.

### Phase 5: Progression Decision
- **Action**: After practice, the system decides if the student is ready to advance (`/api/progression/decide`).
- **Outcomes**:
  - **Advance** (at least 4 of 5 problems): the node is marked mastered (and the nodes below it); the session moves to the next node up the chain.
  - **Remediate** (3 of 5 or fewer): the student chooses Review Prerequisite, Review This Topic (simplified lesson), or Save and Quit.
  - **Complete**: all nodes in the topic chain are mastered.

---

## 5. AI & Knowledge Base Integration

Lessons and practice problems are grounded in the DepEd curriculum through an **offline** Retrieval-Augmented Generation build:
- Source documents (SLM PDFs) are ingested into **ChromaDB** using **LlamaIndex** and **sentence-transformers** (`knowledge_base/`).
- **Google Generative AI** uses the retrieved context to pre-generate lessons, worked examples, and guided explanations, which are stored in the database; practice problems are decomposed with **mathsteps** and stored the same way.
- At runtime ChromaDB is not queried. Gemini is called only to simplify a lesson on request, to give feedback on the first wrong step in standard practice, and to summarize errors at the end of a quiz.
