# SURI - System Workflow and Pipeline Context

This document provides a comprehensive overview of the SURI (Mathematics Learning Platform) system, including its technical stack, architecture, and various processing pipelines. It is designed to provide complete context for future development and integrations.

## 1. Technology Stack

### Frontend
- **Framework**: Next.js (App Router paradigm) with React.
- **Styling**: TailwindCSS for utility-first, responsive design.
- **State & Data Fetching**: Standard React Hooks (`useState`, `useEffect`) and custom typed API wrappers.

### Backend
- **Framework**: FastAPI (Python) served via Uvicorn.
- **Database**: SQLite, accessed asynchronously via `aiosqlite`.
- **Authentication**: Custom JWT (JSON Web Token) implementation utilizing `python-jose` and `bcrypt` for password hashing.
- **AI & RAG Pipeline**: `google-generativeai` (Gemini), `llama-index`, and `chromadb` for Retrieval-Augmented Generation, document parsing, and dynamic content generation.

---

## 2. Authentication Pipeline

The authentication system uses HTTP-only cookies to securely manage sessions without exposing tokens to client-side JavaScript.

1. **Registration** (`POST /api/auth/register`):
   - Accepts `name`, `grade_level`, and `password`.
   - Hashes the password using `bcrypt`.
   - Stores the student record in SQLite.
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
- **Purpose**: Identify what the student already knows to skip unnecessary material.
- **Action**: The system presents multiple-choice diagnostic probes (`/api/diagnostic/{session_id}/probe`).
- **Evaluation**: Answers are evaluated (`/api/diagnostic/{session_id}/answer`). If the student answers correctly, the system assumes mastery of that node. If incorrect, a "gap" is detected, and the user is routed to the lesson phase for that specific gap node.

### Phase 3: Lesson & Content Delivery
- **Action**: The user views educational content for the active gap node (`/api/content/{node_id}`).
- **Content Types**:
  - **Lesson Text**: The main instructional material.
  - **Worked Example**: A step-by-step breakdown.
  - **Guided Explanation**: Further context.
- **AI Integration**: If the student finds the lesson too difficult, they can trigger an AI simplification (`/api/content/{node_id}/simplify`). The backend uses the LLM to rewrite the text to be more accessible.

### Phase 4: Active Practice
- **Action**: After reading the lesson, the user solves practice problems step-by-step (`/api/practice/start`).
- **Evaluation** (`/api/practice/submit-step`): 
  - Each mathematical step the user submits is evaluated.
  - **Misconception Detection**: If a step is wrong, the backend's AI pipeline analyzes the error to identify the specific conceptual misunderstanding (e.g., "Added denominators instead of finding a common denominator").
  - This misconception is logged to the student's history and mapped back to a specific graph node.

### Phase 5: Progression Decision
- **Action**: After practice, the system decides if the student is ready to advance (`/api/progression/decide`).
- **Outcomes**:
  - **Advance**: The current node is marked mastered; the session moves to the next node in the prerequisite chain.
  - **Remediate**: The student is kept on the current node or moved backward to learn foundational concepts based on the misconceptions detected.
  - **Complete**: All nodes in the topic chain are mastered.

---

## 5. AI & Knowledge Base Integration

The system relies heavily on Retrieval-Augmented Generation (RAG) to ground its mathematical instructions:
- Source documents (textbooks, curriculums) are ingested into **ChromaDB** using **LlamaIndex**.
- When generating practice problems, evaluating complex open-ended steps, or simplifying lessons, the system queries the vector database to retrieve relevant pedagogical context.
- **Google Generative AI** interprets this context to ensure that explanations, variables, and problem types strictly adhere to the designated curriculum standards.
