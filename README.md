<div align="center">

<img src="frontend/public/SURI.png" alt="SURI Platform Logo" width="220" />

# SURI — Adaptive Mathematics Learning Platform

**Personalized, Gamified Math Mastery for Philippine Junior High School (Grades 6–10)**

*Diagnose prerequisite gaps • Generate curriculum-aligned lessons • Solve math step-by-step in an interactive 3D voxel world*

---

[![Next.js 16](https://img.shields.io/badge/Frontend-Next.js%2016%20App%20Router-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/UI-React%2019-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%200.110+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Supabase](https://img.shields.io/badge/Database-Supabase%20%2F%20Postgres-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Gemini](https://img.shields.io/badge/AI-Google%20Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://aistudio.google.com/)
[![Three.js](https://img.shields.io/badge/3D-Three.js%20%26%20R3F-049EF4?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel%20Multi--Service-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)
[![Tailwind CSS v4](https://img.shields.io/badge/Styling-Tailwind%20CSS%20v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

[⚡ Quick Start in 30s](#-quick-start-in-30-seconds) • [🏛️ System Architecture](#-system-architecture) • [🔄 Learning Loop](#-the-suri-adaptive-learning-loop) • [🏰 3D World](#-3d-gamified-voxel-world-showcase) • [🚀 Vercel Deploy](#-deploying-to-vercel-multi-service) • [📡 API Reference](#-complete-api-reference)

</div>

---

## 🌟 Executive Overview

**SURI** is an intelligent, gamified learning platform tailored to the Department of Education (DepEd) Philippines curriculum. Rather than presenting static mathematics worksheets, SURI treats math learning as a **directed acyclic graph (DAG)** of 16 foundational competencies spanning Grades 6 through 10.

When a student struggles with high-school topics (such as *Quadratic Equations* or *Systems of Linear Equations*), SURI isolates prerequisite gaps down to foundational skills (such as *Operations on Integers* or *Laws of Exponents*), generates grounded lessons using **Retrieval-Augmented Generation (RAG)** over official DepEd Self-Learning Modules (SLMs), and guides students toward mastery with step-by-step equation solving, interactive formula keyboards, and real-time misconception diagnoses.

```
       [Grade 6: Fractions & Decimals]
                     │
       [Grade 7: Operations on Integers]
                     │
       [Grade 7: Laws of Exponents]
                     │
       [Grade 7: Special Products]
                     │
       [Grade 8: Factoring Polynomials]
                     │
       [Grade 9: Quadratic Equations] 🎯 (Entry Topic)
```

---

## ⚡ Quick Start in 30 Seconds

### Windows One-Click (Recommended)
Double-click [`run.bat`](file:///run.bat) from the project root. It auto-detects your virtual environment (`venv\` or `backend\venv\`), launches the FastAPI backend on `http://localhost:8000`, and starts the Next.js frontend on `http://localhost:3000`.

### Manual Terminal Run

```bash
# Terminal 1 — Backend
venv\Scripts\activate.bat             # Or: .\venv\Scripts\Activate.ps1
uvicorn backend.main:app --reload

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Visit **`http://localhost:3000`** in your browser!

---

## 🏛️ System Architecture

SURI is architected as an atomic multi-service monorepo configured for seamless local development and unified single-domain deployment on **Vercel**:

```mermaid
flowchart TB
    subgraph Client["🌐 Student Client (Browser)"]
        Browser["Desktop & Tablet Browser"]
    end

    subgraph VercelGateway["⚡ Vercel Edge / Single Domain Gateway"]
        VercelRouter["vercel.json URL Rewriter"]
    end

    subgraph FrontendService["🎨 Frontend Service (Next.js 16 + React 19)"]
        R3F["Three.js / React Three Fiber\n(3D Voxel World)"]
        MathUI["MathLive & Virtual Keyboard\n(Formula Editor)"]
        AppRouter["Next.js App Router\n(Dashboard, Topics, Quiz, Progress)"]
    end

    subgraph BackendService["⚙️ Backend Service (FastAPI)"]
        FastAPI["FastAPI REST Server (Python 3.10+)"]
        TimingMiddleware["X-Process-Time-Ms Middleware\n(Latency Tracking)"]
        GraphEngine["Prerequisite Graph Engine\n(graph.py & competency_utils.py)"]
        MathstepsSubprocess["Node.js Mathsteps Subprocess\n(Step-by-Step Solver)"]
    end

    subgraph DataAndAI["🗄️ Database, AI & RAG Pipeline"]
        SupabaseDB[("Supabase PostgreSQL\n(asyncpg Pool)")]
        GeminiAPI["Google Gemini 1.5 API\n(Lessons, Hints, Simplification)"]
        ChromaStore[("ChromaDB Vector Store\n(DepEd SLM Embeddings)")]
    end

    Browser -->|"User HTTP Requests"| VercelRouter
    VercelRouter -->|"Frontend Routes: /(.*)"| AppRouter
    VercelRouter -->|"API Requests: /api/(.*)"| FastAPI

    AppRouter --- R3F
    AppRouter --- MathUI

    FastAPI --- TimingMiddleware
    FastAPI --- GraphEngine
    FastAPI -->|"Executes"| MathstepsSubprocess

    FastAPI -->|"Connection Pool"| SupabaseDB
    FastAPI -->|"LLM Prompts"| GeminiAPI
    FastAPI -->|"LlamaIndex Query"| ChromaStore
```

---

## 🔄 The SURI Adaptive Learning Loop

Every student interaction follows an adaptive mastery cycle designed to eliminate math anxiety and rebuild missing fundamentals:

```mermaid
sequenceDiagram
    autonumber
    actor Student as 🧑‍🎓 Student
    participant World as 🏰 3D World / Dashboard
    participant Diag as 🎯 Diagnostic Engine
    participant AI as 🤖 Gemini RAG Pipeline
    participant Quiz as ✍️ Mathsteps Quiz Engine
    participant DB as 🗄️ Supabase / Graph

    Student->>World: Select Topic (e.g., Quadratic Equations)
    World->>Diag: Start Learning Session (/api/sessions)
    alt Full Diagnostic
        Diag->>Student: Present Prerequisite Probes (/api/diagnostic/probe)
        Student->>Diag: Submit Answers
        Diag->>DB: Identify Gap Node (e.g., Factoring Polynomials)
    else Fast-Track Skip
        Student->>Diag: Skip Diagnostic (/api/diagnostic/skip)
        Diag->>DB: Assign Target Topic Directly
    end

    DB->>AI: Fetch & Generate Lesson (/api/content/:node_id)
    AI-->>Student: Display Lesson, Worked Examples & Visual Guides
    opt Need Simpler Explanation?
        Student->>AI: Click Simplify Lesson (/api/content/:node_id/simplify)
        AI-->>Student: Deliver Simplified Text with Everyday Analogies
    end

    Student->>Quiz: Start Step-by-Step Problem (/api/quiz/start)
    loop Each Algebraic Step
        Student->>Quiz: Submit Formula via Math Keyboard (/api/quiz/submit-step)
        alt Step is Correct
            Quiz-->>Student: ✅ Positive Feedback & Next Step
        else Step has Mistake
            Quiz->>AI: Analyze Misconception
            Quiz-->>Student: ❌ Targeted Hint & Explanation (/api/quiz/use-hint)
            Quiz->>DB: Log to Error History (/api/students/.../progress)
        end
    end

    Quiz->>DB: Compute Final Score (/api/quiz/finish)
    DB->>Student: 🎉 Mastery Confetti Celebration & Update SURI Keep
```

---

## 🏰 3D Gamified Voxel World Showcase

SURI replaces conventional menus with an immersive 3D Voxel Kingdom built with Three.js and `@react-three/fiber`:

| Realm / Island | Component | Visual Experience & Functionality |
| :--- | :--- | :--- |
| **Kingdom World** | `KingdomWorld.tsx` | The central 3D floating archipelago surrounded by procedural voxel oceans, dynamic skies, and ambient lighting. |
| **Topics Library** | `TopicsLibraryWorld.tsx` | The scholarly bookstore island featuring the 3D `TopicBookCarousel`, where students browse and select learning tracks. |
| **Calculator Tower** | `CalculatorTowerWorld.tsx` | A towering voxel spire housing a dedicated math laboratory with real-time MathLive formula calculation. |
| **Progress Trail** | `ProgressTrailWorld.tsx` | A winding highland path visually rendering the student's mastery milestones, completed topics, and active badges. |
| **Focused View** | `FocusedIslandWorld.tsx` | Cinematic camera zooms that seamlessly transition the viewport when inspecting individual landmark islands. |

### 🎮 3D Camera Controls
- **Orbit / Rotate**: `Left Click + Drag`
- **Pan Viewport**: `Right Click + Drag`
- **Zoom In / Out**: `Mouse Scroll Wheel`
- **Select Landmark**: Click directly on any 3D building to trigger island focus and open the corresponding modal.

---

## 🚀 Deploying to Vercel (Multi-Service)

SURI is pre-configured with a top-level [`vercel.json`](file:///vercel.json) that leverages **Vercel Services** to deploy both the **FastAPI Backend** and the **Next.js Frontend** under a single shared domain.

### The `vercel.json` Configuration

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "services": {
    "backend": {
      "root": "backend",
      "framework": "fastapi"
    },
    "frontend": {
      "root": "frontend",
      "framework": "nextjs"
    }
  },
  "rewrites": [
    {
      "source": "/api/solve",
      "destination": {
        "service": "frontend"
      }
    },
    {
      "source": "/api/(.*)",
      "destination": {
        "service": "backend"
      }
    },
    {
      "source": "/(.*)",
      "destination": {
        "service": "frontend"
      }
    }
  ]
}
```

### Why This Architecture Wins
1. **Zero CORS Issues**: Because both the backend and frontend are hosted under the same domain, client requests to `/api/...` are routed internally without cross-origin friction.
2. **Atomic Full-Stack Deployments**: Every Git commit deploys the exact matched version of both API endpoints and UI components simultaneously.
3. **Automatic Scaling**: The Next.js frontend uses Vercel Edge/Serverless functions, while the FastAPI service executes with native Python runtime support.

### Deployment Steps

1. Push your repository to **GitHub**:
   ```bash
   git push origin main
   ```
2. Log in to [Vercel](https://vercel.com) and click **"Add New Project"**.
3. Select your **SURI** repository. Set the project **Root Directory** to the repository root (leave it empty), and set the **Framework Preset** to **Services**. The root `vercel.json` defines both services; each service uses its own framework and build settings. Leave project-level build and output-directory overrides unset.
4. Add your **Environment Variables** in the Vercel Project Settings:
   - `GEMINI_API_KEY`: Your Google AI Studio API key.
   - `DATABASE_URL`: Your Supabase PostgreSQL connection string (Transaction Pooler URI on port `6543` recommended).
   - `JWT_SECRET`: A secure random cryptographic secret string.
5. Click **Deploy**. Your full-stack platform will be live in minutes!

Images live in `frontend/public` and use root-relative URLs such as `/SURI1.png` and `/login/library.png`. Next.js includes this directory automatically. The frontend serves images directly (`images.unoptimized`) so the logo and mascots do not depend on the `/_next/image` optimizer through the Services gateway. This preserves original image files, but downloads can be larger than optimized variants. Do not add service-level `includeFiles`: it is not a supported property of the current `services` configuration.

---

## 📦 Tech Stack & Dependencies Catalog

### 1. Backend (`backend/requirements.txt`)

```text
fastapi>=0.110.0          # Modern async web framework
uvicorn[standard]>=0.27.0 # High-speed ASGI web server
asyncpg>=0.29.0           # Async PostgreSQL driver (Supabase connection pooling)
python-jose[cryptography] # JWT creation, verification, and cookie security
bcrypt>=4.0.0             # Secure cryptographic password hashing
python-multipart          # Form data handling for authentication
chromadb>=0.4.0           # Vector database for DepEd SLM embeddings
llama-index>=0.10.0       # RAG document parsing & retrieval orchestration
sentence-transformers     # Semantic search embedding models
pypdf>=3.0.0              # DepEd SLM curriculum PDF extraction
google-generativeai       # Google Gemini SDK (Dynamic content & hints)
python-dotenv             # Environment variable loader
```

### 2. Frontend (`frontend/package.json`)

```text
next: 16.2.6              # Next.js 16 App Router framework
react & react-dom: 19.2.4 # React 19 UI component library
@react-three/fiber: 9.8.1 # Declarative Three.js for React
@react-three/drei: 10.7.8 # Three.js camera & shader helpers
three: 0.186.0            # 3D graphics engine powering voxel kingdom
tailwindcss: ^4           # Modern utility-first CSS styling
mathlive: 0.109.2         # Interactive mathematical equation editor
react-math-keyboard: 2.0  # On-screen virtual math keypad
katex & rehype-katex      # Fast LaTeX mathematical typography
react-markdown            # Dynamic markdown rendering
canvas-confetti           # Gamified celebration animations
lucide-react              # Clean modern iconography
react-hot-toast           # Toast feedback notifications
patch-package             # React 19 compatibility patcher
```

### 3. Mathsteps Subprocess (`mathsteps_runner/package.json`)

```text
mathsteps: ^0.1.0         # Step-by-step algebra & equation simplifier
```

---

## 🛠️ Step-by-Step Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Tech-Wrightttt/SURI.git
cd SURI
```

### 2. Set Up Python Virtual Environment (`venv`)

Create a dedicated virtual environment in the project root:

```bash
python -m venv venv
```

Activate the virtual environment:

| Operating System / Shell | Activation Command |
| :--- | :--- |
| **Windows — CMD** | `venv\Scripts\activate.bat` |
| **Windows — PowerShell** | `.\venv\Scripts\Activate.ps1` |
| **macOS / Linux — Bash/Zsh** | `source venv/bin/activate` |

> [!TIP]
> If PowerShell blocks script execution, run:
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
> .\venv\Scripts\Activate.ps1
> ```

### 3. Install Backend Dependencies
```bash
pip install --upgrade pip
pip install -r backend/requirements.txt
```

### 4. Install Mathsteps Subprocess Dependencies
```bash
cd mathsteps_runner
npm install
cd ..
```

### 5. Install Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```
*(The `postinstall` script automatically applies the React 19 patch for `@react-three/fiber` via `patch-package`.)*

### 6. Configure Environment Variables
Create a `.env` file in the root directory:

```ini
# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase / PostgreSQL Connection String
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres?sslmode=require

# JWT Auth Secret
JWT_SECRET=super-secret-key-change-this-in-production
```

### 7. Initialize Database (Supabase / PostgreSQL)
1. Open your **Supabase Dashboard** -> **SQL Editor**.
2. Run [`scripts/schema_supabase.sql`](file:///scripts/schema_supabase.sql) to create all relational tables.
3. Run [`scripts/seed_supabase.sql`](file:///scripts/seed_supabase.sql) to seed default topics, lessons, and practice problems.
4. Test connectivity using the latency profiler:
   ```bash
   python db_latency_test.py
   ```

---

## 🏃 Running the Application

### Option A: The One-Click Launcher (`run.bat`)
Run [`run.bat`](file:///run.bat) from the project root. It will open two Command Prompt windows launching the FastAPI backend and Next.js frontend simultaneously:
```cmd
run.bat
```

### Option B: Manual Terminal Execution
- **Terminal 1 (Backend)**:
  ```cmd
  venv\Scripts\activate.bat
  uvicorn backend.main:app --reload
  ```
  *Backend runs on `http://localhost:8000` (Swagger docs at `/docs`).*

- **Terminal 2 (Frontend)**:
  ```bash
  cd frontend
  npm run dev
  ```
  *Frontend runs on `http://localhost:3000`.*

---

## 🔧 Developer & Utility Scripts

| Script | Command | Purpose |
| :--- | :--- | :--- |
| **Supabase Latency Profiler** | `python db_latency_test.py` | Measures raw connect time, pooled query latency, and cold start times. |
| **Knowledge Base Indexer** | `python knowledge_base/build_index.py` | Embeds DepEd SLM PDFs from `knowledge_base/slm_pdfs/` into ChromaDB. |
| **Seed Pre-Generated Content** | `python knowledge_base/load_content_seed.py` | Seeds pre-generated lessons from `content_seed.json` into the database. |
| **Generate Lessons via Gemini** | `python knowledge_base/generate_content.py` | Uses Gemini RAG to synthesize fresh lessons and worked examples. |
| **Generate Practice Problems** | `python knowledge_base/generate_practice.py` | Combines Gemini with `mathsteps` to scaffold step-by-step problem sets. |
| **Generate Distractors** | `python knowledge_base/generate_distractors.py` | Generates realistic multiple-choice distractors for diagnostic items. |
| **Generate Diagnostic Probes** | `python scripts/generate_diagnostic_probes.py` | Compiles diagnostic assessment probes across all graph nodes. |
| **Generate Challenge Items** | `python knowledge_base/challenge/generate_challenge_bank.py <diagnostic\|quiz\|validate\|review\|export> --nodes L1V,SLE` | Generates, verifies and exports the harder "challenge" diagnostic probes and practice problems. See [`knowledge_base/challenge/README.md`](knowledge_base/challenge/README.md). |
| **Test Mathsteps Directly** | `node mathsteps_runner/runner.js "2x + 5 = 15"` | Tests equation parsing and step output via command line. |
| **Integration Smoke Test** | `python scratch/verify_suri.py` | Runs automated end-to-end checks against all API endpoints. |

---

## 🗺️ Prerequisite Learning Graph

SURI structures math topics across Grades 6 to 10 into 4 primary learning chains:

```mermaid
graph LR
    subgraph Grade6["Grade 6 Foundation"]
        FD["FD: Fractions & Decimals"]
        RPP["RPP: Ratio, Proportion, Percent"]
    end

    subgraph Grade7["Grade 7 Fundamentals"]
        OI["OI: Operations on Integers"]
        LE["LE: Laws of Exponents"]
        SP["SP: Special Products"]
        AE["AE: Algebraic Expressions"]
        L1V["L1V: Linear Eq. in 1 Variable"]
    end

    subgraph Grade8["Grade 8 Intermediate"]
        FP["FP: Factoring Polynomials"]
        L2V["L2V: Linear Eq. in 2 Variables"]
        PO["PO: Polynomial Operations"]
        SLE["🎯 SLE: Systems of Linear Eq."]
    end

    subgraph Grade9["Grade 9 Advanced"]
        QE["🎯 QE: Quadratic Equations"]
        RER["🎯 RER: Rational Exponents & Radicals"]
    end

    subgraph Grade10["Grade 10 Mastery"]
        PD["PD: Polynomial Division (not used in any chain)"]
        PE["🎯 PE: Polynomial Equations"]
    end

    FD --> OI
    OI --> LE
    LE --> SP
    SP --> FP
    FP --> QE

    FD --> RPP
    RPP --> AE
    AE --> L1V
    L1V --> L2V
    L2V --> SLE

    LE --> RER

    PO --> PE

    classDef entry fill:#4F46E5,stroke:#312E81,stroke-width:2px,color:#fff;
    class QE,SLE,RER,PE entry;
```

---

## 📡 Complete API Reference

All backend routes are served under the `/api` prefix on `http://localhost:8000`:

### 🔐 1. Authentication (`/api/auth`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Registers new student (`name`, `email`, `grade_level`, `password`) and sets HTTP-only JWT cookie. |
| `POST` | `/api/auth/login` | Authenticates student with `email` and `password`, sets HTTP-only session cookie. |
| `POST` | `/api/auth/logout` | Clears student authentication cookie. |
| `GET` | `/api/auth/me` | Returns current authenticated student details (`student_id`, `name`). |

### 📚 2. Topics & Catalog (`/api`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/topics` | Lists all entry-level topics (QE, SLE, RER, PE). |
| `GET` | `/api/topics/catalog` | Returns topic catalog and full prerequisite chains in a single payload. |
| `GET` | `/api/topics/{node_id}/chain` | Returns prerequisite chain from the specified node down to foundational floor. |
| `GET` | `/api/topics/{node_id}/intro` | Returns introductory metadata and overview description for a topic node. |

### 📊 3. Student Progress (`/api`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/students/{student_id}/progress` | Returns student active sessions, completed sessions, and misconception error history. |

### 🎯 4. Learning Sessions (`/api/sessions`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/sessions` | Creates or resumes a learning session for an entry topic node. |
| `GET` | `/api/sessions/{session_id}` | Retrieves session details and current active node. |
| `PATCH` | `/api/sessions/{session_id}` | Updates session state (current node or completion status). |
| `PATCH` | `/api/sessions/{session_id}/progress` | Updates completion percentage for the current session. |

### 🩺 5. Diagnostic Assessments (`/api/diagnostic`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/diagnostic/{session_id}/probe` | Retrieves the next diagnostic question for the session. |
| `POST` | `/api/diagnostic/{session_id}/answer` | Submits an answer to a diagnostic probe. A node ends at 3 correct (pass) or 2 wrong (fail); a failed node stops the diagnostic. |
| `POST` | `/api/diagnostic/{session_id}/submit` | Submits complete batch diagnostic assessment. |
| `POST` | `/api/diagnostic/skip` | Skips diagnostic assessment and immediately routes student to targeted learning. |

### 📖 6. Lesson Content & Simplification (`/api/content`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/content/{node_id}` | Fetches lesson text, worked example, and guided explanation for a node. |
| `POST` | `/api/content/{node_id}/simplify` | Generates a simplified, student-friendly lesson explanation via Gemini. |

### ✍️ 7. Practice Problems (`/api/practice`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/practice/start` | Retrieves or generates a scaffolded practice problem set for a node. |
| `POST` | `/api/practice/submit-step` | Evaluates a single mathematical step submitted by the student, detecting misconceptions. |

### 🏆 8. Interactive Quiz Engine (`/api/quiz`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/quiz/start` | Initializes a quiz session for a competency node. |
| `POST` | `/api/quiz/submit-step` | Validates a step in a multi-step quiz problem with real-time feedback. |
| `POST` | `/api/quiz/skip-step` | Skips the current step with appropriate score adjustment and explanation. |
| `POST` | `/api/quiz/use-hint` | Requests a contextual hint for the current problem step. |
| `POST` | `/api/quiz/finish` | Concludes the quiz, computes total score, and updates competency status. |

### 📈 9. Learning Progression (`/api/progression`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/progression/decide` | Evaluates mastery score and determines whether to **advance** or **remediate**. |

### ⚡ 10. Fast Graph Traversal (`/api/graph`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/graph/{topic_entry_node}/chain` | High-speed in-memory lookup of prerequisite chain (zero database overhead). |

---

## ❓ Troubleshooting & FAQ

<details>
<summary><b>1. PowerShell: "Running scripts is disabled on this system"</b></summary>

**Error:** `.\venv\Scripts\Activate.ps1 : File cannot be loaded because running scripts is disabled on this system.`  
**Solution:** Open PowerShell and set the execution policy for your current session:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\venv\Scripts\Activate.ps1
```
</details>

<details>
<summary><b>2. ModuleNotFoundError: No module named 'backend'</b></summary>

**Error:** `ModuleNotFoundError: No module named 'backend'` when starting `uvicorn`.  
**Solution:** Ensure you execute `uvicorn backend.main:app --reload` from the **project root folder** (`SURI/`), NOT from inside the `backend/` folder.
</details>

<details>
<summary><b>3. Supabase Database Connection Timeout</b></summary>

**Error:** `asyncpg.exceptions.CannotConnectNowError` or connection timeout during startup.  
**Solutions:**
- Confirm your `DATABASE_URL` in `.env` is formatted with `?sslmode=require`.
- If using Supabase Connection Pooling, connect to port `6543` (transaction pooler) instead of port `5432`.
- Run `python db_latency_test.py` to check direct connectivity and isolate network delays.
</details>

<details>
<summary><b>4. Mathsteps Subprocess: File Not Found Error</b></summary>

**Error:** `mathsteps runner failed or timed out: [WinError 2] The system cannot find the file specified`.  
**Solution:** Ensure Node.js is installed on your machine and run `npm install` inside the `mathsteps_runner` directory:
```bash
cd mathsteps_runner
npm install
cd ..
```
</details>

<details>
<summary><b>5. React 19 / React Three Fiber Conflicts</b></summary>

**Error:** Peer dependency mismatch with React 19.  
**Solution:** SURI includes a pre-packaged patch in `frontend/patches/`. Run:
```bash
cd frontend
npm install --legacy-peer-deps
npm run postinstall
cd ..
```
</details>

---

## 📄 License & Attribution

This project is developed for educational research and mathematics instruction for Philippine Junior High School students under the Department of Education (DepEd) curriculum guidelines.
