# LegacyLoop

LegacyLoop helps teams prepare evidence-backed knowledge handovers when a project contributor leaves or changes roles. Teams collect project records in a case, inspect deterministic activity signals, turn source material into cited claims for human review, and create a handover from approved claims. Evidence records and their citations stay linked throughout the workflow.

## What the application includes

- A Next.js App Router frontend with a dashboard, case directory, case setup and editing, evidence explorer, ownership and contributor signals, claims, review queue, handover workspace, and successor acknowledgement view.
- An Express 5 JSON API backed by MongoDB and Mongoose. The API handles cases, evidence ingestion, analysis, claim generation and versioning, reviews, permissions, and handovers.
- Deterministic analysis of imported Git history, task and pull request records, and timestamped evidence. Gemini-assisted claim generation is optional and requires a backend API key.

## Repository layout

```text
frontend/   Next.js application, UI components, API client, and frontend tests
backend/    Express API, MongoDB models, ingestion and analysis services, and backend tests
README.md   Project overview and local setup
```

See [frontend/README.md](frontend/README.md) and [backend/README.md](backend/README.md) for package-specific instructions and API examples.

## Requirements

- Node.js 20.9 or newer and npm
- MongoDB reachable by the backend
- A Gemini API key only if you want AI-assisted claim generation

## Run locally

Start the API from the backend directory:

```sh
cd backend
npm install
cp .env.example .env
npm run dev
```

The backend loads `backend/.env`. Defaults are MongoDB at `mongodb://127.0.0.1:27017/legacyloop`, API port `4000`, frontend CORS origin `http://localhost:3000`, and stale pull request threshold `14` days. It connects to MongoDB before listening. Set `GEMINI_API_KEY` to enable generated claims; `GEMINI_MODEL` optionally selects the model (default `gemini-3.8-flash`). Without a key, claim generation returns `AI_NOT_CONFIGURED`.

In another terminal, start the frontend:

```sh
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open <http://localhost:3000>. The frontend `dev` script checks API health and starts the local backend when it is not already healthy, then launches Next.js. MongoDB must be available. Use `npm run dev:next` to run Next.js without that coordination when the API is already running.

Frontend environment variables (in `frontend/.env.local`):

| Variable | Purpose | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | API base URL, including `/api` | `http://localhost:4000/api` |
| `NEXT_PUBLIC_DEMO_USER` | Local demo identity | `demo-reviewer` in development |
| `NEXT_PUBLIC_DEMO_ROLE` | Local demo role | `reviewer` in development |

Backend environment variables (in `backend/.env`):

| Variable | Purpose | Default |
| --- | --- | --- |
| `NODE_ENV` | Runtime mode | `development` |
| `PORT` | API port | `4000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/legacyloop` |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:3000` |
| `STALE_PR_DAYS` | Age threshold for stale open pull requests | `14` |
| `GEMINI_API_KEY` | Gemini credential for claim generation | unset |
| `GEMINI_MODEL` | Gemini model used for generation | `gemini-3.8-flash` |

Do not put secrets in `NEXT_PUBLIC_*` variables; Next.js exposes them to browser code.

## Typical workflow

1. Create a case with a project name, title, departing member, successor, and optional description.
2. Upload one or more JSON, CSV, Markdown, or Git repository ZIP files as evidence.
3. Inspect evidence and run deterministic analysis for module activity, contributor signals, open work, and the evidence timeline.
4. Create claims manually or request AI-assisted claim generation. Claims link to evidence and require exact quotations; generated claims remain pending review.
5. In the review queue, reviewers approve, reject, edit, or request more evidence. Review actions are recorded, and claim edits create a new version.
6. Generate the handover from approved, current claims the viewer may access. The resulting version is published on generation. The successor view lets the matching successor identity acknowledge items or flag them as unclear or needing clarification.

The dashboard and case workspace show case details and workflow progress. The case workspace also links to evidence, ownership analysis, claims, reviews, and handover. The handover workspace supports a print view. The successor page is a separate read-oriented route and requires `caseId` as a query parameter.

## Evidence ingestion and analysis

Supported uploads are `.json`, `.csv`, `.md`, `.markdown`, and `.zip` containing a Git repository with a `.git` directory. Uploads use multipart field `files`, allow up to 10 files at 10 MB each, and may return HTTP `207` with per-file errors while preserving successful imports. ZIP extraction is limited to 5,000 entries, 50 MB per entry, and 100 MB total expanded size; unsafe paths and symbolic links are rejected. Git history is read without checkout or hook execution; uploaded Git configuration and external object references are ignored. Duplicate evidence is skipped by content hash, and evidence records are immutable.

JSON supports an object, an array, or common record collections such as `records`, `messages`, `pull_requests`, `tasks`, `items`, and `data`. CSV rows need a text, description, title, summary, or message column. Filenames and record fields help infer source types. JSON and CSV records may set `accessLevel` to `team`, `leads_only`, or `restricted`; Markdown and Git records default to `team`.

Obvious credential-like strings, email addresses, and phone numbers are redacted from returned evidence. Original parsed data is stored separately and excluded from normal queries and API responses. Redaction is pattern-based and best effort. Analysis runs over evidence accessible to the current role. Git activity indicates recorded contribution, not proof of ownership or expertise. Tasks and pull requests count as open only when source fields explicitly indicate an open state; stale pull requests use `STALE_PR_DAYS`.

## Claims, review, and handovers

Claims link to evidence and exact quotations. Citation validation normalizes whitespace but otherwise requires the quoted wording and letter case to match the evidence. Valid citations do not establish that a claim is supported: AI support verification is not implemented, so claims can remain `needs_ai_review`. Gemini generation proposes claims and validates their structure and citations; it never approves them. Generation requires `GEMINI_API_KEY` and uses the Google `@google/genai` SDK.

Deterministic conflict detection identifies potential differences in supported technical settings for human review; it is not a general contradiction detector. Claims inherit the most restrictive access level of their linked evidence. A handover includes approved, current, non-conflicting claims with valid citations and accessible evidence. Sections cover project overview, module ownership, work in progress, technical decisions, dependencies, risks, knowledge gaps, first-week priorities, and unanswered questions. Empty sections identify information gaps. Regeneration creates a new version when the handover content changes.

## Local identity and permissions

In development, the frontend sends `x-demo-user: demo-reviewer` and `x-demo-role: reviewer` by default. Override them with `NEXT_PUBLIC_DEMO_USER` and `NEXT_PUBLIC_DEMO_ROLE`. The API derives a stable local user record from these headers. This is development scaffolding, not authentication; the demo identity routes are disabled when `NODE_ENV=production`, and production authentication is not implemented.

| Role | Evidence access | Case visibility and actions |
| --- | --- | --- |
| `team_member` | `team` | Cases created by or assigned to the user |
| `successor` | `team` | Cases created by or assigned to the user; may acknowledge own matching handover |
| `reviewer` | `team`, `leads_only` | Cases created by or assigned to the user; may review claims |
| `admin` | All access levels | All non-archived cases; may review claims |

Case creation does not assign a reviewer. To assign one locally, first make a request as that reviewer's demo identity and role to create its user record, then add the returned user ID to the case's `reviewerIds` using `PATCH /api/cases/:id`. Only the case creator or an admin can update a case. Demo headers can be chosen by the caller and provide no production security.

## API overview

All endpoints are under `/api`. Except health, most case, evidence, analysis, claim, review, and handover endpoints require the development identity headers above. Successful responses use a JSON envelope with `success`, `message`, and `data`; errors include `error.code`.

| Area | Routes | Purpose |
| --- | --- | --- |
| Health and identity | `GET /health`, `GET /auth/me` | API/database health and current development identity |
| Cases | `GET/POST /cases`, `GET/PATCH/DELETE /cases/:id`, `GET /cases/:id/progress` | List, create, inspect, update, archive, and track cases |
| Evidence | `POST /cases/:id/upload`, `GET /cases/:id/evidence`, `GET /evidence/:id` | Import and read evidence |
| Analysis | `POST /cases/:id/analyze`, `GET /cases/:id/ownership`, `/open-work`, `/timeline`, `/contributors`, `GET /cases/:id/git/history?file=...` | Generate reports and inspect file history |
| Claims | `POST /cases/:id/claims`, `POST /cases/:id/claims/generate`, `GET /cases/:id/claims`, `GET/PATCH /claims/:id`, `GET /claims/:id/conflicts` | Create, generate, list, version, and inspect claims |
| Reviews | `POST /claims/:id/review`, `GET /cases/:id/reviews` | Record review actions and read audit history |
| Handover | `GET /cases/:id/handover`, `POST /handover/:id/acknowledge` | Generate or retrieve the viewer-specific published handover and record successor feedback |

`DELETE /cases/:id` archives the case; it does not delete evidence. `GET /cases/:id/handover` generates a new version only when the content changes. API requests are rate-limited to 300 per 15 minutes, with uploads limited to 20 per 15 minutes.

## Commands

Run commands from the named package directory.

| Directory | Command | Purpose |
| --- | --- | --- |
| `frontend` | `npm run dev` | Start coordinated local development stack |
| `frontend` | `npm run dev:next` | Start Next.js without backend startup coordination |
| `frontend` | `npm run lint` | Run ESLint |
| `frontend` | `npm run test` | Run the Vitest suite |
| `frontend` | `npm run build` / `npm run start` | Build / serve the Next.js app |
| `backend` | `npm run dev` | Start API with Node watch mode |
| `backend` | `npm start` | Start API |
| `backend` | `npm test` | Run the Node test suite |
