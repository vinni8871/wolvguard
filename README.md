# WOLVGUARD — Digital Risk Protection
**Team WOLVANT · “See the Impersonation. Stop the Threat.”**

A React/TypeScript + Node.js application with authenticated workspace persistence, real **YouTube channel search**, **Apple Ads Platform app search**, Gemini workspace assistance, calculated image comparison, official-asset exclusions, and explainable investigation workflows. Provider credentials stay server-side. This is not a claim of production completeness, perfect accuracy or platform-wide coverage.

## Run
```sh
npm install
npm run build
npm start
```
Website and same-origin API: port **5173**, listening on `0.0.0.0`. Optional environment variable `PORT` changes the production port. Frontend code uses relative `/api` URLs. For development, run `npm run dev:api` (port 3001) and `npm run dev` (Vite with same-origin `/api` proxy) in separate terminals.

Copy `.env.example` to the ignored `.env` file. `YOUTUBE_API_KEY` and `GEMINI_API_KEY` are server-only. Apple Ads also requires its OAuth client/team/key IDs, ad-account ID, and private PEM key. Only the `VITE_SUPABASE_*` values are exposed to the browser. Node loads `.env` through the npm `start` / `dev:api` scripts.

## Routes
- `#home`: marketing landing page with a left-scrolling platform marquee; the dashboard is not embedded here. Launch dashboard opens the dedicated live Overview.
- `#live`: real provider workspace; remembers selected page for the browser session.
- `#app`: legacy route redirects to `#live`; no separate demo dashboard is exposed.
- `#login`: Supabase Email + Password login and signup when the Vite Supabase variables are configured.
- `/judge-demo.html`: six-slide keyboard-navigable presentation.
- Judge presentation, audit notes, and synthetic regression fixtures remain in the separate presentation/test assets, not the live workspace.

## Rubric coverage
The supplied screenshot weights Social Monitoring 30%, App Monitoring 30%, Brand Profile 15%, UX 15%, Presentation/Demo 10%. The earlier Apple-only implementation was not sufficient. This revision implements demonstrable paths in all five categories:

| Criterion | Implemented behavior | Important boundary |
|---|---|---|
| Social media | Real YouTube Data API channel search, channel ID/name/description/avatar evidence, verified exact-channel exclusion | YouTube only; bounded keyword search, not comprehensive platform monitoring |
| App stores | Apple Ads Platform app search, app ID/name/developer evidence and verified exact-app-ID exclusion | Apple Ads OAuth account access is required; the API search response has limited metadata |
| Brand profile | Validated public name/HTTPS website, description, local reference logo upload, provider-specific official assets, manual evidence verification, revocation and removal | Manual evidence is not automated ownership proof |
| UX | Live/demo separation, filters, sorting, pagination, global search, cancellation, graceful failures, source links, notes/history, notifications, exports, responsive layouts | Supabase Auth and RLS scope account workspace data to one user; no shared-organization roles |
| Demo | Six-slide deck, timed presenter guide, rubric audit and runnable detection/image/exclusion checks | Test fixtures are synthetic and never inserted into live intelligence |

Read `public/EVALUATION-AUDIT.md` for the full criterion-by-criterion assessment. No judge score is self-awarded or guaranteed.

## Working sources and endpoints
### Apple Ads Platform
`POST /api/apple/search`
```json
{"term":"Your public brand","country":"us","limit":10}
```
The server calls `GET https://api.ads.apple.com/v1/search/apps` with `query`, `storeFronts`, `limit`, and `offset`. It caches the Apple OAuth access token in memory and scopes requests with the configured ad-account ID. Search results include real Adam IDs, app names, developer names and listing URLs. Limits: 1–25. Apple OAuth configuration is required; no public iTunes fallback or fabricated result is used.

### YouTube
`POST /api/youtube/search` accepts the same bounded request and calls YouTube Data API v3 `search.list` with `type=channel`. The API key is used only by the Node server. Search responses are cached for five minutes and capped to protect the API quota.

### Gemini assistant
`POST /api/chat` sends recent chat turns and a bounded summary of the signed-in user's workspace to Gemini `generateContent`. The API key stays server-side; messages are not stored by this application. Chat requests happen only on submit, with a per-peer rate limit and no automatic retry.

### Logo/avatar fingerprints
`POST /api/image-fingerprint` accepts `{"url":"PUBLIC_PROVIDER_IMAGE_URL"}`. Only HTTPS exact Apple, YouTube (`yt3.ggpht.com` / `i.ytimg.com`), and legacy Bluesky image hosts without credentials or custom ports are allowed. Redirects are rejected. Images must be PNG/JPEG/WebP, at most 2 MB and 20 megapixels, with an 8-second fetch timeout. Native `sharp` decodes, composites over white and normalizes to 9×8 RGB pixels. The server computes a 64-bit difference hash plus mean RGB; it does not invent logo similarity when an image fails.

A user reference PNG/JPEG/WebP is normalized and fingerprinted locally via Canvas. The uploaded image never leaves the browser. Candidate images are fetched/fingerprinted by the server only if a reference logo exists, using three workers. Failed optional image comparisons appear as an unavailable signal, not as a failed primary search or guessed value.

### Provider status
`GET /api/providers` reports provider and Supabase/Gemini configuration and last successful provider calls. This reflects last observation, not a continuously probed service-health guarantee. It never returns API key values.

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
1. Register the actual provider URL. Apple uses an exact numeric app ID; YouTube uses a canonical channel ID URL.
2. Asset begins unverified. Neither name, URL nor publisher match alone verifies it.
3. User records independent ownership evidence and confirms the attestation.
4. Exact verified provider IDs are excluded from current findings immediately. Current alerts for that official identity are removed. Other lookalikes are not excluded.
5. Verification can be revoked or the asset removed after confirmation, recalculating current comparisons.

Original per-scan evidence snapshots remain in scan records; current candidate comparisons may change after asset verification. Authenticated account reviews and workspace state sync to Supabase; unauthenticated local mode remains browser-local and is not a tamper-proof audit trail.

## Scan lifecycle and failure handling
- Running → Completed only when a real successful response has been parsed; the workspace then syncs changes to Supabase when authenticated, or browser storage in local mode.
- Empty response → Completed, zero results.
- Omitted malformed source rows → Partial with an explanation.
- Network, provider, quota or invalid-response error → Failed, safe error detail and no replacement candidates.
- Cancel → request abort and Failed/cancelled record, no new candidates saved.
- Browser interruption → unresolved Running record becomes Failed on reopening, explaining that completion could not be verified.
- Searches use a 5-minute public-response cache; `fetchedAt` remains the original API response time, distinct from the local scan time.
- Primary provider timeout 18 seconds; client total scan timeout 120 seconds to accommodate optional image workers.
- Conservative single-process limits: 12 provider searches per observed peer per minute, YouTube 3 uncached searches/minute and a 70-request rolling daily safety budget, max 2 upstream searches concurrently. Gemini: 10 requests/peer/minute. Images: 100 peer requests/minute, max 4 concurrent image fetches, 1-hour fingerprint cache up to 100 entries. Hosting behind a proxy may share peer limits across users. In-memory budgets reset when the server restarts.

## Data/privacy boundaries
- Authenticated live workspace data uses Supabase tables with RLS. If Supabase is not configured, the route is unavailable for account access rather than presenting synthetic records as live data.
- Email delivery, auto-reporting and takedowns are not configured. Use Email + Password; disable email confirmation for the no-email hackathon flow. Local fallback records remain accessible to anyone using that browser profile.
- Public brand terms/regions/result limits go to the providers. In authenticated mode, official asset evidence and reviews are stored in the account database; uploaded reference images stay in the browser. Public candidate image URLs go to the image service.
- Server retains public API response/fingerprint caches in memory, not user brand/review/scan databases. This application does not log search terms; infrastructure/providers may have independent logging.
- Source images display from their provider CDN; source links use `noreferrer`.
- In-app alerts are real local records, deduplicated by candidate identity. Email is explicitly Not Configured. Support exports an unsent draft.
- Exports: JSON workspace, scan snapshot and investigation evidence/reviews. Browser-local data has no cloud recovery. Cloud data is persisted in Supabase.
- The 30/90/365-day retention value is a saved preference; cloud data is not automatically deleted by a retention scheduler.

## Testing
```sh
npm test                         # scoring, provider, OAuth-shape and assistant tests
# Start the website first, then:
node tests/full-audit.mjs         # provider browser workflow, if credentials are configured
node tests/smoke.mjs              # local UI smoke workflow
```
A clean environment may need `npx playwright install --with-deps chromium`. Provider unit responses are fixtures; real-provider browser tests make actual public requests. Manual-verification evidence in the isolated test browser is expressly test-only and does not claim independent verification of a real brand. Tests produce JSON results and screenshots under `tests/`.

Current checks cover 30 scoring/provider/image/SSRF tests, the nine rubric fixtures (included in that total), and grouped browser control workflows. Passing tests is evidence of tested paths, not a proof of zero defects, perpetual external availability, perfect classification or a guaranteed evaluation score.

## Source references
- Bluesky public AppView documentation: https://endpoints.bsky.app/#bluesky-app
- Apple Search API documentation: https://performance-partners.apple.com/search-api

## Unsupported integrations
Instagram/Facebook/X/Google Play are not implemented. Gemini assistance is informational and not an automated verdict. The current browser workspace uses `supabase/schema.sql`; the earlier `001_initial.sql` and Edge Functions target a legacy schema and are not invoked by the current frontend. See `supabase/DEPLOYMENT.md` before applying database migrations. Multi-user organization roles, production email delivery, automated retention and takedowns are not implemented. Apple Ads requires API credentials and an authorized ad account; those credentials are not present in this workspace yet.

## Project structure
- `components/live/`: supported live workflows and rubric/evaluation UI.
- `components/ui/`: reusable, shadcn-compatible UI and adapted supplied components.
- `lib/`: scoring, image fingerprints, rubric fixtures and unit tests.
- `server/`: Node HTTP routes, modular provider adapters, restricted image service and tests.
- `public/`: judge presentation and downloadable documentation.
- `styles.css`: responsive tokens/styles, dark/light theme.

### Latest recorded audit
`public/QA-RESULTS.json` contains the recorded validation summary: 30 unit checks, 31 browser workflow groups, and 98 static button definitions with no missing action wiring. The large optional Three.js globe is lazy-loaded separately from the live workspace and has a tested non-WebGL fallback. This is test coverage evidence, not a zero-defect guarantee.
