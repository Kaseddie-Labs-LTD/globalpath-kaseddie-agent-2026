# GlobalPath Kaseddie Agent — Unified Master Steering Rules

These are the absolute, non-negotiable rules that govern all development work on this project.
They apply to every file edit, feature addition, bug fix, and refactor — no exceptions.

---

## 1. Security & Key Insulation

### Backend Proxy Rule
All AI and LLM calls must route through the secure backend proxy (`/api/*` endpoints).
Do **not** expand, add new callers to, or replicate the browser-direct pattern found in
`services/gemini.ts` — that file is legacy. Future AI actions (pitch generation, compliance
auditing, lead enrichment) must originate from the FastAPI backend, never directly from the
client bundle.

### Fail-Fast Secrets
The backend must throw a fatal startup error and refuse to boot if `JWT_SECRET` is absent in
the environment. Remove the hardcoded predictable string fallback that silently keeps the server
running without a proper secret. In production, missing `JWT_SECRET` = hard crash, full stop.

### Production Environment Gating
The debugging endpoint `GET /api/debug/env` must be wrapped in a strict environment check:

```python
if os.getenv("ENV") != "production":
    # register the debug route
```

Or remove it entirely before triggering any live build on Render. It must never be reachable
on the production domain.

### Typo Realignment
The env var `VITE_ADMIN_PASSWORDk` (trailing `k`) is a typo. Correct it to `VITE_ADMIN_PASSWORD`
across every environment file (`.env`, `.env.example`, `.env.local`) and confirm the backend
reads the corrected name. Admin login silently failing because of a key mismatch is unacceptable.

---

## 2. Code Integrity & Structure

### ADK Runner Execution Path
`my_agent_setup.py` is at the project root and imports `utils.db_sync_pipeline` as a Python
package. The ADK runner must always be invoked from the **project root directory**, never from
inside `backend/`. Example: `python my_agent_setup.py` or `python local_runtime.py` from
`globalpath-kaseddie-agent/`, not from `globalpath-kaseddie-agent/backend/`.

### Missing Dependency: `utils/db_sync_pipeline.py`
This file is imported by `my_agent_setup.py` and `test_agent_sandbox.py` but **does not exist**.
The Google ADK agent crashes with `ImportError` on every startup until this file is created.
Before any work on the ADK agent pipeline, this module must be scaffolded and implemented with
the following four functions: `check_illegal_fees`, `enrich_lead_data`,
`hybrid_vector_mongo_lookup`, `query_corridor_stats`.

### Zero-Drop Lead Integrity — `service_domestic` Category
The four lead sector categories are: `professional`, `blue_collar`, `service_domestic`, `general`.
The `service_domestic` category covers ~310 leads and is identified by keywords:
`[cleaner, housekeeper, maid, nanny, domestic, janitor, nurse]`.

Rules:
- `service_domestic` and `general` must be present in every Zod schema enum for `category`.
  The current `schema.ts` only validates `blue_collar | professional` — this must be fixed.
- `totalLeadsCount` must aggregate all four categories. If the displayed count is below ~850,
  `service_domestic` nodes are being filtered out — diagnose and fix immediately.
- Never omit these categories from dashboard summary cards, filter dropdowns, or API query params.

### Duplicate Route — `POST /api/sync-apify-leads`
This route is defined twice in `backend/main.py` (approximately lines 600 and 2575). FastAPI
silently uses the first. The second definition is dead code. Remove the duplicate before adding
any new sync logic to this endpoint.

### Tree-Shake Audit (Mandatory on Every Component Update)
Every time a component or service file is modified:
1. Identify all imports and variables in the file.
2. Remove any that are no longer referenced after your change.
3. Remove commented-out code blocks — do not leave them "for later".
4. Dead directories (`.crewai/`, legacy DigitalOcean shims when fully replaced) must be cleaned up.
5. Do not deploy if a `ReferenceError` or unused-import lint warning exists in the changed file.

### `constants/api.ts` Must Not Be Empty
This file is imported by `services/ai.ts` and other frontend services for `API_BASE` and
`fetcher`. It is currently empty on disk, which causes runtime failures. Any change that
touches the services layer must first confirm this file is populated and exporting correctly.

### `AppView` Enum — Single Source of Truth
`AppView` is declared in both `types.ts` and `primitive-types.ts`. All components must import
`AppView` exclusively from `primitive-types.ts` (the zero-import island). Do not add imports
to `primitive-types.ts` — it must remain dependency-free to prevent circular import chains.

---

## 3. UX & Aesthetic Boundary

### Cyberpunk / Glassmorphism UI — Non-Negotiable
The dark-mode glassmorphism aesthetic (neon markers, blur panels, interface drop shadows,
neon accent colors) must remain completely intact. Do not introduce:
- Unstyled HTML elements with no Tailwind classes
- Light-mode-only color choices
- Flat/material design components that break the visual language

Every new component must match the existing dark panel + neon accent pattern.

### Visible Mission Branding
The labels **"AI Handshake Verified"** and **"Ethical Zero-Fee Guarantee"** must remain
persistently rendered in prominent, visible positions in the UI. Do not hide them behind
toggles, collapse them into tooltips, or remove them during layout refactors.

### SearchSummary 3-Column Grid
The `SearchSummary` component must maintain its 3-column grid layout. Do not collapse it to
fewer columns in any responsive breakpoint adjustment.

### `isProcessing` State in AI Components
Every AI Consultant or chat UI component must maintain an `isProcessing` boolean state that
provides visible pulsing/loading feedback during async operations. Never remove this state
or its visual indicator.

---

## 4. Core Logic Preservation

### Kaseddie AI Kiroween Logic
Do **not** refactor or remove the core Kaseddie AI Kiroween agent logic without an explicit
instruction from the project owner followed by explicit confirmation before the change is made.

### Location Safety — `handleNodeClickSafe` / `getJobLocationString`
Always use `handleNodeClickSafe` when handling node clicks on the map. Always use
`getJobLocationString()` to render location values. Never render a raw `location` object
directly — if the value is a JSON object (e.g., a JP-NODE or DE-NODE), extract the `city`
string or fall back to `"Global"`.

### Ethical Compliance Flags
- Zero-Fee mandate: any lead that mentions candidate-paid fees must be flagged `NON-COMPLIANT`.
- GCC leads (UAE): must include housing and transportation allowances or be flagged for review.
- The `illegalFeeDetected` and `fee_blocked` fields on the `Job` type must never be silently
  dropped or ignored when rendering lead cards.

---

## 5. Process Rules

### Read Before Modifying
Always read a file before editing it. This codebase contains 3000-line files with
non-obvious dependencies. Never propose changes to code that has not been read first.

### Confirmation Before Deletion
Before deleting any code block, function, component, or file, summarize exactly what will be
removed and why, then wait for confirmation. This applies even to code that looks unused.

### API Endpoint Method Support
`POST /api/sync` and all enrollment endpoints must support `POST` requests. If a
`405 Method Not Allowed` error appears, fix it immediately — do not leave it open.

### No New `.js` Files
The project is 100% TypeScript. All new frontend files must use `.tsx` (components) or `.ts`
(utilities, services, types). The TypeScript compiler is configured with `allowJs: true` for
legacy compatibility only — this is not an invitation to write new JavaScript.

### Build Verification Before Reporting Done
After any code change, confirm the Vite build (`npm run build`) completes without errors before
stating the task is complete. A command exiting 0 is not sufficient — check for TypeScript
errors and `ReferenceError` warnings in the output.

---

## 6. Environment & Deployment

### `.env.example` — Placeholders Only
The `.env.example` file currently contains live credentials (Groq key, Qdrant JWT, MongoDB
Atlas URI with password, Gemini key). These must be rotated and the file sanitized to use
placeholder values only, e.g., `GROQ_API_KEY=your_groq_api_key_here`. Never commit real
secrets to any example or template file.

### No CI/CD Exists
There is no `.gitlab-ci.yml`, `Dockerfile`, or deployment manifest. All deployments are
manual. Coordinate deploy steps explicitly — never assume a pipeline will catch regressions.
Before any production push to Render, run `npm run build` locally and confirm zero errors.

### Tailwind Dual-Load Awareness
Tailwind CSS is loaded twice: compiled via PostCSS (`tailwind.config.ts`) and via CDN inline
in `index.html`. The CDN version uses a slightly different brand color palette. In production
(Vite build output), only the compiled version runs. Do not add new custom color tokens to
the CDN inline config in `index.html` — add them to `tailwind.config.ts` as the single source
of truth for theme tokens.

---

## 7. Git Workflow

### Commit and Push After Every Completed Task
Every time a unit of work is finished and verified (build passes, no errors), the changes
**must** be committed and pushed to GitHub before moving on to the next task. Do not
accumulate multiple unrelated changes in a single commit.

Commit message format:
```
<type>(<scope>): <short description>

- bullet point describing what changed and why
- second bullet if multiple files were touched
```

Types: `fix`, `feat`, `refactor`, `chore`, `docs`, `security`

Examples:
```
fix(routing): wrap App in BrowserRouter to resolve useNavigate crash

- index.tsx: added BrowserRouter wrapper around App
- AdminDashboard.tsx: replaced navigate('/hr-portal') with onPitch callback
- HRPortal.tsx: removed useLocation, replaced with pitchContext prop effect
```

```
security(.env): sanitize .env.example — replace all live credentials with placeholders
```

### Branch Safety
- Never push directly to `main` unless explicitly instructed by the project owner.
- Push to a feature branch (`fix/...`, `feat/...`) and open a PR when working on
  multi-file changes that touch auth, routing, or the backend API surface.
- For single-file hotfixes that have been build-verified locally, direct push to `main`
  is acceptable only with explicit confirmation.

### Pre-Push Checklist
Before every `git push`:
1. `npm run build` passes with zero TypeScript errors.
2. No `.env`, `.env.local`, or files containing real credentials are staged.
3. No `console.log` debug statements left in production code paths.
4. Tree-Shake Audit complete on every modified component file.

