# LegacyLoop Backend

Phases 1–8 of the LegacyLoop API use Node.js ES modules, Express, Mongoose, and MongoDB.

## Setup

```sh
cp .env.example .env
npm install
npm run dev
```

Configure `MONGODB_URI`, `PORT`, `NODE_ENV`, `CORS_ORIGIN`, and optionally `STALE_PR_DAYS` in `.env`. The API starts only after MongoDB connects. `STALE_PR_DAYS` defaults to 14. Run tests with `npm test`.

During development, case endpoints require an `x-demo-user` header, for example `x-demo-user: reviewer-1`. That identity deterministically scopes cases by creator. This is a development stub, not real authentication, and case routes reject requests when `NODE_ENV=production`; configure real authentication before production use.

## Case and upload API

Create a case:

```sh
curl -X POST http://localhost:4000/api/cases \
  -H 'content-type: application/json' -H 'x-demo-user: reviewer-1' \
  -d '{"title":"Payments handover","projectName":"Payments","departingMember":"Alex","successor":"Sam"}'
```

Upload JSON, CSV, Markdown, or a Git repository ZIP (multipart field `files`):

```sh
curl -X POST http://localhost:4000/api/cases/CASE_ID/upload \
  -H 'x-demo-user: reviewer-1' \
  -F 'files=@tasks.csv' -F 'files=@payments-repository.zip'
```

The API is rate-limited to 300 requests per 15 minutes per client, with uploads limited to 20 per 15 minutes. Uploads allow up to 10 files, 10 MB each, and ZIP extraction is limited to 5,000 entries and 100 MB expanded data. Unsupported or failed files are identified in the response summary; partial failures return HTTP 207. Git ZIPs must contain a `.git` directory. Git history is read without checkout or hook execution; uploaded Git config and external object references are ignored.

Evidence endpoints:

```text
GET /api/cases/CASE_ID/evidence
GET /api/evidence/EVIDENCE_ID
GET /api/cases/CASE_ID/git/history?file=src/payments/retry.js
```

Obvious credentials, email addresses, and phone numbers are redacted from evidence returned by the API. Original parsed evidence is stored separately in a Mongoose field excluded from normal queries and API responses. Pattern-based redaction is best effort, not comprehensive PII detection.

## Deterministic analysis

```text
POST /api/cases/CASE_ID/analyze
GET  /api/cases/CASE_ID/ownership
GET  /api/cases/CASE_ID/open-work
GET  /api/cases/CASE_ID/timeline
GET  /api/cases/CASE_ID/contributors
```

Analysis uses stored evidence only. Git activity is reported as a potential knowledge-concentration signal, not proof of ownership. Task or PR status must be present in source records to be classified as open. Stale PRs use the configurable `STALE_PR_DAYS` threshold.

DELETE `/api/cases/CASE_ID` archives a case by setting `archivedAt`; it does not remove evidence records.

## Claims and verification

Claims are created with `evidenceIds` plus exact quotation citations. Whitespace differences are normalized; wording and case are otherwise matched exactly. Claims without evidence are stored as `missing_evidence`; bad quotations are stored as `unsupported`. Valid citations still receive `needs_ai_review` because no AI support verifier is configured.

### AI-assisted claim generation

`POST /api/cases/CASE_ID/claims/generate` uses only evidence the caller can access, includes deterministic analysis context, validates provider output and exact quotations, and stores new claims with `status: pending` and `reviewStatus: pending`. It never approves claims. Repeated requests skip generation-key duplicates. Configure `GEMINI_API_KEY` and optionally `GEMINI_MODEL` in the backend `.env`; the default is `gemini-3.8-flash`, which supports structured output and reasoning. Without a key the endpoint returns `AI_NOT_CONFIGURED` instead of pretending generation succeeded. Claim generation uses Google's official `@google/genai` SDK.

Transient Gemini server and network failures use bounded exponential backoff with jitter. A rate limit is retried only when Gemini provides a retry delay of 10 seconds or less and the error does not indicate exhausted quota. Successful earlier batches are saved immediately and remain intact if a later batch fails.

The repository has no separate payment dummy dataset. Generation tests use a synthetic fixture under `tests/fixtures/claim-generation-evidence.js` for production retry limit 3, its rationale, a staging-only limit 10 experiment, unfinished refund idempotency, unassigned work, and restricted evidence.

Example:

```sh
curl -X POST http://localhost:4000/api/cases/CASE_ID/claims/generate \
  -H 'x-demo-user: reviewer-1' -H 'x-demo-role: reviewer'
```

```sh
curl -X POST http://localhost:4000/api/cases/CASE_ID/claims \
  -H 'content-type: application/json' -H 'x-demo-user: reviewer-1' \
  -d '{"text":"Payment retries are limited to three attempts.","claimType":"technical_decision","evidenceIds":["EVIDENCE_ID"],"citations":[{"evidenceId":"EVIDENCE_ID","quote":"Retries are limited to three attempts."}]}'
```

```text
GET   /api/cases/CASE_ID/claims
GET   /api/claims/CLAIM_ID
GET   /api/claims/CLAIM_ID/conflicts
PATCH /api/claims/CLAIM_ID
```

PATCH creates a new version and keeps the prior claim available by ID. Deterministic conflict matches create a `ClaimConflict` relationship and mark both current claims `conflicting`; these are review candidates, not automatic contradiction judgments.

## Permissions and human review

Evidence and claim responses are filtered before returning data:

- `team_member` and `successor`: `team`
- `reviewer`: `team` and `leads_only`
- `admin`: all three access levels

Claims inherit the most restrictive access level among their evidence. To assign a separate reviewer in the development setup, that reviewer first registers their demo identity and role, then the case owner assigns the returned ID:

```sh
curl -H 'x-demo-user: reviewer-1' -H 'x-demo-role: reviewer' http://localhost:4000/api/auth/me
curl -X PATCH http://localhost:4000/api/cases/CASE_ID \
  -H 'content-type: application/json' -H 'x-demo-user: owner-1' \
  -d '{"reviewerIds":["REVIEWER_USER_ID"]}'
```

Review actions are recorded for audit:

```text
POST /api/claims/CLAIM_ID/review
GET  /api/cases/CASE_ID/reviews
```

The POST body uses `action` values `approve`, `reject`, `edit`, or `needs_more_evidence`. Only reviewers and admins may perform these actions. Approval is blocked for missing-evidence, unsupported, conflicting, or pending-verification claims. Editing creates a new claim version and reruns citation checks.

The `x-demo-user` and `x-demo-role` headers are development scaffolding and can be chosen by the caller. They are disabled in production; production authorization must use verified identities and roles.

## Handover generation and successor acknowledgement

`GET /api/cases/CASE_ID/handover` creates or returns an idempotent role-specific published handover. It includes only approved, non-conflicting claims with citations that still match evidence the viewer may access. Empty sections state what approved information is missing. The successor's development identity must match the case's `successor` field.

```sh
curl -H 'x-demo-user: phase8-successor' -H 'x-demo-role: successor' \
  http://localhost:4000/api/cases/CASE_ID/handover
```

The response sections contain claim `items`; use an item's `id` for an acknowledgement:

```sh
curl -X POST http://localhost:4000/api/handover/HANDOVER_ID/acknowledge \
  -H 'content-type: application/json' \
  -H 'x-demo-user: phase8-successor' -H 'x-demo-role: successor' \
  -d '{"itemId":"CLAIM_ID","action":"request_clarification","comment":"Please explain the retry limit."}'
```

Acknowledgement actions are `acknowledge`, `unclear`, and `request_clarification`. Each action is stored. A handover becomes `acknowledged` when every claim item is acknowledged; unclear or clarification requests set it to `needs_revision`.
