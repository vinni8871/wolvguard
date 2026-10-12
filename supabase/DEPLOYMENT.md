# WOLVGUARD
**See the Impersonation. Stop the Threat.** Developed by **Team WOLVANT**.

Project: WolvGuard — AI-Powered Digital Risk Protection for Social Media and Mobile Applications.

## Run
```sh
npm install
npm run dev
npm run build
npm test
```
React 19, TypeScript, Vite, Tailwind 4, Lucide, React Three Fiber, and shadcn-compatible structure. Components live at `/components/ui`, utilities at `/lib`, and styles at `/styles.css`. The `@/` alias maps to the root. `components.json` enables adding shadcn components without moving the existing UI. Tailwind is integrated using the Vite plugin. No separate TypeScript/Tailwind setup is required.

## What works now
- Responsive dark landing page, rotating globe adapted from the supplied hero, platform capability strip (not false partner endorsements), features, process, security, support draft download, and footer.
- Dedicated **unauthenticated demo** workspace; persistent demo-only indicator. Demo data is synthetic and stored in localStorage, never in live backend tables.
- Overview, local brand add/edit/archive, asset registration and explicit **demo** verification, YouTube/App Store sample monitoring, filters, sorting, pagination, candidate detail, review notes and append-only local review history, confirmation for impersonation classification, sample scan history, in-app preview notifications, local notification threshold, and settings.
- Sample scan adds a synthetic candidate with duplicate prevention and history. It does not contact external platforms.
- Offline deterministic help guide, explicitly not AI. Risk engine uses explainable string heuristics, not a trained model or fraud probability.
- TypeScript production build and five unit tests.

## What is NOT connected / production-ready
No Supabase project, real authentication, email provider, or live YouTube credentials are connected in this environment. The app deliberately does **not** offer a fake login or pretend localStorage is Supabase persistence. Live mode remains gated. The backend below is deployment source, not a tested live integration. Production frontend Auth/session handling, authenticated CRUD/query hooks and Edge Function invocation still need to be wired and tested before live mode is enabled.

Other boundaries: no real logo comparison, no Instagram/Facebook/X/Google Play integrations, no contact email verification flow, no production email delivery, no LLM, no automatic takedowns. Support exports a draft; it does not send a message. Trend, risk distribution and source comparison summarize current synthetic demo records. Retention saves a preference but has no deletion scheduler. Demo profiles/settings do not create private identities. Asset demo forms include account/app name, platform, URL, publisher and icon URL. Production verification still requires an independent evidence workflow. The supplied contact/login blocks were adapted to avoid invented support addresses, fabricated testimonials, and fake OAuth redirects, rather than copied with those misleading behaviors.

## Deploy Supabase backend
Create your own Supabase project, then install the Supabase CLI separately and run:
```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase secrets set YOUTUBE_API_KEY='YOUR_SERVER_SIDE_KEY'
supabase secrets set APP_ORIGIN='https://YOUR_APP_ORIGIN'
supabase functions deploy youtube-brand-scan
supabase functions deploy apple-brand-scan
```
Never commit keys. Use the CLI/secret manager securely; avoid leaving secrets in shared shell history. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are supplied by the Supabase Edge runtime. Service-role credentials and provider keys are **never** sent to the browser or logged. CORS restricts browser calls to APP_ORIGIN; a valid JWT and brand ownership are still required.

Migration: `supabase/migrations/001_initial.sql` defines profiles, brands, official_assets, scan_runs, candidates, findings, finding_reviews, notifications, integration_settings; UUID keys, indexes, FK cascades, checks, and RLS. This is **single-owner tenancy**, not shared organization authorization. Scan/candidate/finding creation is server-only; users read only their own records. Reviews are append-only and update status transactionally. Email verification cannot be assigned from an authenticated browser. Changing contact email clears verification. Configure scheduled recovery of stale Running scans after runtime termination, and a retention job, before production.

After deploying, wire frontend Auth with the public project URL and publishable/anon key only, use authenticated Supabase queries, and render live results from separate state/storage. Do not reuse synthetic IDs or records in live mode. Verify tenant isolation using two test accounts before release.

## API contract
Both functions accept authenticated POST JSON:
```json
{"brand_id":"REGISTERED_BRAND_UUID","limit":10}
```
Limits: integer 1–25; query derived only from an owned, nonarchived registered brand. One scan per brand/provider/minute and only one active scan for each pair. Configure project/user-wide quotas and abuse protection for production. YouTube uses official v3 `search` with `type=channel`, `part=snippet`. Apple uses the documented iTunes Search API with `entity=software`, US region. This is a bounded keyword search, not comprehensive monitoring.

The registry in `_shared/providers.ts` is extensible. Adapters return normalized candidates with source identifiers, links, permitted metadata, and timestamps. Missing credentials, quota/permissions, rate limits, network timeouts, malformed responses and persistence failures return safe structured errors. Failures never produce synthetic replacement candidates. Scan failures are recorded Failed or Partial as appropriate; zero results are a valid completed scan. Crash recovery and response fixtures should be tested in the deployed environment.

Official accounts are excluded only by exact source ID or URL and an explicit verified timestamp. Publishers are compared only when verified official publisher metadata exists. There is no general assumption that a different display name is suspicious.

## Scoring
`lib/detection.ts` (mirrored for the Deno runtime): Unicode NFKC, case/punctuation/space normalization, normalized Levenshtein distance. Signals/weights: name 35, logo 30, description 15, metadata 20. Missing signals remain `null`; normalize against the available weight sum. Logo is always unavailable. Name-only evidence is capped at **49**, including when there is no corroborating metadata or strong description similarity. Thresholds default to Low <30, Medium 30–59, High 60–84, Critical ≥85. Backend settings permit ordered thresholds. The demo settings exposes alert threshold, not risk-label thresholds. Every new finding is Needs Review. No score implies a fraud probability. Mixed-script confusable analysis and robust image comparison are future work, not claimed capabilities.

## Notifications
Demo notification center offers previews. Backend inserts unique in-app alert records and checks previous source/brand/provider alert history to avoid repeated alerts. Email is explicitly **Not Configured**. Production delivery requires verified-recipient challenge handling, server-only email adapter, idempotent transactional outbox, provider acceptance IDs and delivery webhooks. Never mark an email delivered merely because a request was queued. Never email unverified contacts.

## Release checklist
- Apply and test migration in a staging Supabase project; run RLS tests for cross-user read/write attempts on every table.
- Implement real frontend session lifecycle and authenticated data hooks; keep demo/local and live state separate.
- Test real provider results, empty results, quotas, missing keys, partial inserts, network timeouts, and concurrent scans.
- Test email verification and outbox idempotency if adding delivery.
- Add server-side limits per authenticated user, scan worker recovery, transactional ingestion, audit export, data-retention scheduling and monitoring.
- Add real ownership verification workflow and source-link display for live results.
- Keyboard focus trapping and Escape dismissal are implemented for modals; complete a broader accessibility audit before public production use.
- Replace sample dates and placeholder example domains only when using actual user-provided data.
