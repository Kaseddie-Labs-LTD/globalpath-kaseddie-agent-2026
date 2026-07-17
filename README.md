# GlobalPath Kaseddie Agent 2026

An AI-native recruitment node matching underemployed talent in international corridors (Uganda–Canada–UAE–EU) with B2B supply chain and technical trade placement using Qdrant vector memory, Gemini optimization, and Groq programmatic healing.

---

## 🚀 Tech Stack

*   **Frontend:** React (Vite) + TypeScript + TailwindCSS + SWR
*   **Backend:** FastAPI (Python 3) + Gunicorn/Uvicorn
*   **Vector Database:** Qdrant Vector DB (persistent semantic memory)
*   **AI Engine:** Gemini API (contextual grounding & proposal generation)
*   **Performance Layer:** Groq API (real-time Title Healer)
*   **Data Ingestion:** Apify Scraper Integration
*   **Validation:** End-to-end runtime protection with Zod schemas

---

## 🛡️ Key Features

*   **Zero-Trust Data Sanitization:** Programmatically scrubs raw scraper mock data (fake `hr@slug.com` emails and generic placeholder titles) on the fly before surfacing them to the UI.
*   **Groq-Powered Title Healer:** Backend validation that catches and corrects ambiguous or incomplete raw job titles. 
*   **Failsafe Queuing System:** When the title healer fails or API limits are hit, leads are automatically offloaded to a local queue (`pending_review.json`) for human review, keeping the primary pipeline crash-proof.
*   **Vector Memory Vault:** High-dimensional semantic indexing using Qdrant to ensure fast, context-aware talent matching.
*   **Agentic Pitch Generator:** Multi-jurisdiction compliance-aware B2B pitch drafts optimized with Gemini.

---

## 🛠️ Local Development Setup

### 1. Frontend Setup (React/Vite)
Navigate to the root directory and install dependencies:
```bash
npm install
npm run dev
- Reliability: A built‑in retry (3 attempts with backoff) mitigates wake‑up latency and transient network errors.
Backend Setup (FastAPI)
Navigate to the /backend directory, set up your environment, and spin up the server:

Bash
cd backend
python -m venv venv
source venv/Scripts/activate  # Windows (PowerShell) or venv/bin/activate (Unix)
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
3. Environment Variables (.env)
Make sure both environments are configured securely:

Ini, TOML
# Backend (.env)
JWT_SECRET=your_production_jwt_secret
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key
QDRANT_URL=your_qdrant_instance_url
QDRANT_API_KEY=your_qdrant_api_key
Ini, TOML
# Frontend (.env)
VITE_API_URL=http://localhost:8000

---

### Step 2: Push it directly to `main` on GitHub

Run these commands in your PowerShell terminal to update the repo:

<Sequence>
{/* Reason: Procedural steps to commit and push the updated README safely directly to main */}
  <Step title="Save and Check status">
    Verify that your changes to `README.md` are tracked.
    ```powershell
    git status
    ```
  </Step>
  <Step title="Stage and Commit">
    Stage the updated `README.md` file and commit it.
    ```powershell
    git add README.md
    git commit -m "docs: update README to match FastAPI, Gemini, and Qdrant production stack"
    ```
  </Step>
  <Step title="Push directly to main">
    Push the changes immediately to GitHub so collaborators see it right now.
    ```powershell
    git push origin main
    ```
  </Step>
</Sequence>
