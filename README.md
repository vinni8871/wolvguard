# WOLVGUARD — Digital Risk Protection
**Team WOLVANT · “See the Impersonation. Stop the Threat.”**

A working React/TypeScript + Node.js prototype with real **Bluesky social profile search**, real **Apple App Store search**, calculated image comparison, official-asset exclusions and explainable investigation workflows. No paid provider or API key is required for those two sources. This is not a claim of production completeness, perfect accuracy or platform-wide coverage.

## Run
```sh
npm install
npm run build
npm start
```
Website and same-origin API: port **5173**, listening on `0.0.0.0`. Optional environment variable `PORT` changes the production port. Frontend code uses relative `/api` URLs. For development, run `npm run dev:api` (port 3001) and `npm run dev` (Vite with same-origin `/api` proxy) in separate terminals.

## Routes
- `#home`: landing page and explicitly labelled synthetic dashboard preview.
- `#live`: real provider workspace; remembers selected page for the browser session.
- `#app`: dedicated synthetic demo. It never becomes live data when a provider fails.
- `#login`: honest unauthenticated access disclosure; no fake OAuth or account creation.
- `/judge-demo.html`: six-slide keyboard-navigable presentation.
- Live sidebar **Demo & Evaluation**: rubric assessment, presenter notes, audit download and nine runnable synthetic checks.

## Rubric coverage
The supplied screenshot weights Social Monitoring 30%, App Monitoring 30%, Brand Profile 15%, UX 15%, Presentation/Demo 10%. The earlier Apple-only implementation was not sufficient. This revision implements demonstrable paths in all five categories:

| Criterion | Implemented behavior | Important boundary |
|---|---|---|
| Social media | Real Bluesky public actor search, stable DID resolution, name/handle/description/avatar evidence, verified exact-DID exclusion | Bluesky only; not every social platform or comprehensive network monitoring |
| App stores | Real Apple software search, publisher/description/icon evidence and verified exact-app-ID exclusion | Apple only; bounded keyword search |
| Brand profile | Validated public name/HTTPS website, description, local reference logo upload, provider-specific official assets, manual evidence verification, revocation and removal | Manual evidence is not automated ownership proof |
| UX | Live/demo separation, filters, sorting, pagination, global search, cancellation, graceful failures, source links, notes/history, notifications, exports, responsive layouts | Browser-local storage and local reviewer—not an authenticated organization |
| Demo | Six-slide deck, timed presenter guide, rubric audit and runnable detection/image/exclusion checks | Test fixtures are synthetic and never inserted into live intelligence |

Read `public/EVALUATION-AUDIT.md` for the full criterion-by-criterion assessment. No judge score is self-awarded or guaranteed.

## Working sources and endpoints
### Apple
`POST /api/apple/search`
```json
{"term":"Your public brand","country":"us","limit":10}
```
Calls `https://itunes.apple.com/search` with `entity=software`. Supported UI regions: US, India, UK, Canada, Australia, Germany, France, Japan. Limits: integer 1–25. Result fields include real Apple IDs, HTTPS listing URLs, available publisher/description/icon and other metadata. No fabricated fallbacks.

### Bluesky
`POST /api/bluesky/search` accepts the same bounded request; search is global, regardless of the ignored country setting. Calls public `app.bsky.actor.searchActors` at `https://public.api.bsky.app`.

`POST /api/bluesky/resolve` accepts `{"actor":"handle.example"}` or a DID. Calls public `app.bsky.actor.getProfile` to register the stable DID. Resolving a handle establishes an identifier, **not ownership**.

### Logo/avatar fingerprints
`POST /api/image-fingerprint` accepts `{"url":"PUBLIC_PROVIDER_IMAGE_URL"}`. Only HTTPS `cdn.bsky.app` and `isN-ssl.mzstatic.com` URLs without credentials or custom ports are allowed. Redirects are rejected. Images must be PNG/JPEG/WebP, at most 2 MB and 20 megapixels, with an 8-second fetch timeout. Native `sharp` decodes, composites over white and normalizes to 9×8 RGB pixels. The server computes a 64-bit difference hash plus mean RGB; it does not invent logo similarity when an image fails.

A user reference PNG/JPEG/WebP is normalized and fingerprinted locally via Canvas. The uploaded image never leaves the browser. Candidate images are fetched/fingerprinted by the server only if a reference logo exists, using three workers. Failed optional image comparisons appear as an unavailable signal, not as a failed primary search or guessed value.

### Provider status
`GET /api/providers` reports Apple/Bluesky Available before first success, Connected after a real successful request, Error after an upstream failure, and the latest response timestamp. This reflects last observation, not a continuously probed service-health guarantee. It also reports unavailable YouTube/Auth/Email and the supported image method.

## Detection engine
`lib/detection.ts` and `lib/live-detection.ts` contain the transparent rules:
- Normalize NFKC Unicode, case, spacing and punctuation.
- Name signal uses normalized Levenshtein, exact brand-token recognition within longer names, and a small documented common-lookalike character map. Not exhaustive multilingual confusable detection.
- Description signal uses shared-token cosine similarity over unique tokens of length ≥3 (bounded to 2,000 reference / 4,000 candidate characters in the live comparison).
- Publisher/account difference is available only against manually verified official metadata for the same provider. Missing official references remain unavailable.
- Logo similarity is `0.7 × dHash similarity + 0.3 × mean-RGB similarity`; this is a simple visual heuristic, not robust semantic logo recognition. False positives and missed transformed logos are possible.
- Base weights: name 35%, logo 30%, description 15%, metadata 20%. Unavailable signals are omitted and available weights normalized.
- Name-only evidence is capped at 49 and below the configured High threshold. Corroborating signals are required for higher scores. Scores are not fraud probabilities.
- Default severity thresholds: Medium 30, High 60, Critical 85. Live settings require ascending values and High ≥50.
- Potential-match filter: not an official identity, score ≥Medium, and name similarity ≥35% or computed logo similarity ≥85%.
- Every new candidate starts Needs Review. Confirmed Impersonation requires explicit user confirmation and a note; a verified official identity cannot be classified as impersonation without revoking verification first.

## Official exclusions and history
1. Register the actual provider URL. Apple uses an exact numeric app ID; Bluesky URLs are resolved to stable DIDs.
2. Asset begins unverified. Neither name, URL nor publisher match alone verifies it.
3. User records independent ownership evidence and confirms the attestation.
4. Exact verified provider IDs are excluded from current findings immediately. Current alerts for that official identity are removed. Other lookalikes are not excluded.
5. Verification can be revoked or the asset removed after confirmation, recalculating current comparisons.

Original per-scan evidence snapshots remain in scan records; current candidate comparisons may change after asset verification. Candidate updates retain review history with the score and evidence retrieval timestamp used at review time. UI review history is append-only, but localStorage is not tamper-proof or an authorized multi-user audit trail.

## Scan lifecycle and failure handling
- Running → Completed only when a real successful response has been parsed and recorded locally.
- Empty response → Completed, zero results.
- Omitted malformed source rows → Partial with an explanation.
- Network, provider, quota or invalid-response error → Failed, safe error detail and no replacement candidates.
- Cancel → request abort and Failed/cancelled record, no new candidates saved.
- Browser interruption → unresolved Running record becomes Failed on reopening, explaining that completion could not be verified.
- Searches use a 5-minute public-response cache; `fetchedAt` remains the original API response time, distinct from the local scan time.
- Primary provider timeout 18 seconds; client total scan timeout 120 seconds to accommodate optional image workers.
- Conservative single-process limits: 20 search/resolve requests per observed peer per minute, 15 uncached requests per provider per minute, max 2 upstream searches concurrently. Images: 100 peer requests/minute, max 4 concurrent image fetches, 1-hour fingerprint cache up to 100 entries. Hosting behind a proxy may share peer limits across users. Caches reset when the server restarts.

## Data/privacy boundaries
- Live state: `wolvguard-live-workspace-v1`; demo uses separate `wg-demo-*` / demo preference keys.
- No authenticated company account, secure tenant database, email delivery, auto-reporting or takedowns. Do not enter sensitive private data. Anyone using the same browser profile may access records.
- Public brand terms/regions/result limits go to the providers. Official descriptions, verification notes, uploaded reference image and reviews remain browser-local. Public candidate image URLs go to the image service.
- Server retains public API response/fingerprint caches in memory, not user brand/review/scan databases. This application does not log search terms; infrastructure/providers may have independent logging.
- Source images display from their provider CDN; source links use `noreferrer`.
- In-app alerts are real local records, deduplicated by candidate identity. Email is explicitly Not Configured. Support exports an unsent draft.
- Exports: JSON workspace, scan snapshot and investigation evidence/reviews. Clearing browser storage loses records without an export; there is no cloud recovery.
- Local 30/90/365-day retention applies on opening the workspace; expired candidate evidence, scans and related alerts are pruned. Brand definitions remain.

## Testing
```sh
npm test                         # 30 unit checks in this revision
# Start the website first, then:
node tests/full-audit.mjs         # real Apple + Bluesky browser workflow, labelled failure fixtures
node tests/demo-controls.mjs     # landing/demo/support/settings/control paths
node tests/smoke.mjs              # original synthetic workflow regression
```
A clean environment may need `npx playwright install --with-deps chromium`. Provider unit responses are fixtures; real-provider browser tests make actual public requests. Manual-verification evidence in the isolated test browser is expressly test-only and does not claim independent verification of a real brand. Tests produce JSON results and screenshots under `tests/`.

Current checks cover 30 scoring/provider/image/SSRF tests, the nine rubric fixtures (included in that total), and grouped browser control workflows. Passing tests is evidence of tested paths, not a proof of zero defects, perpetual external availability, perfect classification or a guaranteed evaluation score.

## Source references
- Bluesky public AppView documentation: https://endpoints.bsky.app/#bluesky-app
- Apple Search API documentation: https://performance-partners.apple.com/search-api

## Unsupported integrations
YouTube needs an authorized API key; Instagram/Facebook/X/Google Play are not implemented. No LLM call is claimed. Existing Supabase migration/Edge Functions remain optional, unconnected source under `supabase/`. They are not prerequisites for the current public-provider deployment. A production company deployment still needs actual Auth, RLS-tested tenant storage, protected audit records, stronger abuse controls and verified email/outbox integration. `supabase/DEPLOYMENT.md` is the archived earlier setup reference, not current runtime capability documentation.

## Project structure
- `components/live/`: supported live workflows and rubric/evaluation UI.
- `components/ui/`: reusable, shadcn-compatible UI and adapted supplied components.
- `lib/`: scoring, image fingerprints, rubric fixtures and unit tests.
- `server/`: Node HTTP routes, modular provider adapters, restricted image service and tests.
- `public/`: judge presentation and downloadable documentation.
- `styles.css`: responsive tokens/styles, dark/light theme.

### Latest recorded audit
`public/QA-RESULTS.json` contains the recorded validation summary: 30 unit checks, 31 browser workflow groups, and 98 static button definitions with no missing action wiring. The large optional Three.js globe is lazy-loaded separately from the live workspace and has a tested non-WebGL fallback. This is test coverage evidence, not a zero-defect guarantee.
