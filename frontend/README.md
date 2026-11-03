# LegacyLoop frontend

Next.js App Router frontend for LegacyLoop, kept separate from the Express backend in `../backend`.

## Requirements

- Node.js 20.9 or newer
- npm
- The LegacyLoop Express API and MongoDB for live case data

## Install and run

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open <http://localhost:3000>. The API URL defaults to `http://localhost:4000/api`, matching the local backend configuration. Start the backend separately. The optional demo identity headers are intended only for local development; production authentication should use the backend's real auth flow.

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Express API base URL, including `/api` |
| `NEXT_PUBLIC_DEMO_USER` | Local development identity header, if enabled by the backend |
| `NEXT_PUBLIC_DEMO_ROLE` | Local development role header, if enabled by the backend |

No secrets belong in `NEXT_PUBLIC_*` variables because Next.js exposes them to browser code.

## Scripts

```bash
npm run dev
npm run lint
npm run test
npm run build
npm run start
```

## Implemented so far

The responsive application shell, design tokens, centralized API client, dashboard, case directory, multi-step case creation, case overview/editing, file upload, evidence explorer, ownership analysis, deterministic project analysis, claims, human review, generated handovers and the successor acknowledgement view are implemented.

The current backend does not provide an AI claim extraction service, so analysis reports do not create claims. Claims can be added with evidence citations, then the backend performs its deterministic citation checks. The upload endpoint does not accept a global access-level field; JSON and CSV parsers support per-record `accessLevel`, and other formats use their backend defaults. Handover generation publishes the resulting version directly; no separate publish endpoint exists. The successor view requires `caseId` in its query string and must be opened with a demo identity whose role is `successor` and whose name matches the case's successor.
