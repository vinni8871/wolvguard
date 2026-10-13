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

## Current status and boundaries
The frontend uses Supabase Email + Password Auth and the account-scoped workspace when both Vite variables are configured. Auth sessions persist across reloads; `#live` is protected. YouTube channel search, Apple Ads app search, and Gemini chat use server-side Node `/api` routes. Provider keys never enter the browser bundle. Without Supabase config, the workspace keeps a clearly labeled browser-local fallback. No service-role credential is used in the browser.

Other boundaries: no Instagram/Facebook/X/Google Play integrations, no production email delivery, no automatic takedowns, and no cloud retention scheduler. Gemini is an informational assistant, not a verdict engine. Trend charts derive from the signed-in workspace data. Asset registration and verification remain a human workflow; registration alone does not prove ownership.

## Supabase setup
The active browser workspace uses `supabase/schema.sql` and the tables `profiles`, `brands`, `brand_assets`, `scan_runs`, `candidates`, `findings`, `finding_reviews`, `notifications`, and `user_settings`. Apply that file once to the target project before using the authenticated workspace. For an already initialized current-schema project, apply `migrations/002_workspace_query_indexes.sql` and `migrations/003_youtube_provider.sql` rather than rerunning the schema file, because its RLS policies are not all idempotent.

For a no-email hackathon flow, enable Email under Authentication providers and turn off email confirmation. Password login itself sends no email; signup may send confirmation mail until that project setting is disabled. Keep only the publishable key in `VITE_SUPABASE_PUBLISHABLE_KEY`; never expose SMTP or service-role credentials in frontend variables.

Copy the server-only variable names from `.env.example` into the ignored `.env` file. `YOUTUBE_API_KEY` enables YouTube Data API v3; `GEMINI_API_KEY` enables Gemini chat and `GEMINI_MODEL` optionally selects the model. Apple Ads requires an API-enabled Apple Ads user, uploaded public key, client ID, team ID, key ID, Apple Ads ad-account ID, and matching private key in `APPLE_ADS_*` variables. Those Apple Ads values are not present in the current `.env`, so the provider reports Not Configured until supplied. Keep the private key server-only; represent PEM newlines as literal `\\n` inside the `.env` value.

`migrations/001_initial.sql` and the Edge Functions below describe the earlier `official_assets` / `integration_settings` backend, not the current browser workspace schema. Do not run that legacy migration against a project initialized with `schema.sql` or deploy those functions against the current schema without first reconciling their table contracts. The current live browser search uses the Node `/api` routes; the Edge Functions are not invoked by that frontend. Never commit keys. Use secret managers for any server-side credentials.

## Legacy Edge Function API
The existing Edge Functions are not called by the current frontend and target the earlier schema. If separately migrated, both accept authenticated POST JSON:
```json
{"brand_id":"REGISTERED_BRAND_UUID","limit":10}
```
Limits: integer 1–25; query derived only from an owned, nonarchived registered brand. One scan per brand/provider/minute and only one active scan for each pair. Configure project/user-wide quotas and abuse protection for production. Those legacy Edge Functions must not be deployed against `schema.sql` until reconciled.

The registry in `_shared/providers.ts` is extensible. Adapters return normalized candidates with source identifiers, links, permitted metadata, and timestamps. Missing credentials, quota/permissions, rate limits, network timeouts, malformed responses and persistence failures return safe structured errors. Failures never produce synthetic replacement candidates. Scan failures are recorded Failed or Partial as appropriate; zero results are a valid completed scan. Crash recovery and response fixtures should be tested in the deployed environment.

Official accounts are excluded only by exact source ID or URL and an explicit verified timestamp. Publishers are compared only when verified official publisher metadata exists. There is no general assumption that a different display name is suspicious.

## Scoring
`lib/detection.ts` (mirrored for the Deno runtime): Unicode NFKC, case/punctuation/space normalization, normalized Levenshtein distance. Signals/weights: name 35, logo 30, description 15, metadata 20. Missing signals remain `null`; normalize against the available weight sum. Logo is always unavailable. Name-only evidence is capped at **49**, including when there is no corroborating metadata or strong description similarity. Thresholds default to Low <30, Medium 30–59, High 60–84, Critical ≥85. Backend settings permit ordered thresholds. The demo settings exposes alert threshold, not risk-label thresholds. Every new finding is Needs Review. No score implies a fraud probability. Mixed-script confusable analysis and robust image comparison are future work, not claimed capabilities.

## Notifications
The current workspace stores in-app alert records in the account database. Email notifications are not configured or sent. Production email delivery would require verified-recipient challenge handling, a server-only email adapter, an idempotent transactional outbox, provider acceptance IDs, and delivery webhooks.

## Release checklist
- Apply and test migration in a staging Supabase project; run RLS tests for cross-user read/write attempts on every table.
- Test session restoration, authenticated CRUD, and cross-user RLS isolation with two staging accounts.
- Test YouTube/Apple Ads results, empty responses, quotas, missing keys, network timeouts, and provider authentication expiry.
- Test email verification and outbox idempotency if adding delivery.
- Add server-side limits per authenticated user, scan worker recovery, transactional ingestion, audit export, data-retention scheduling and monitoring.
- Add real ownership verification workflow and source-link display for live results.
- Keyboard focus trapping and Escape dismissal are implemented for modals; complete a broader accessibility audit before public production use.
- Replace sample dates and placeholder example domains only when using actual user-provided data.
