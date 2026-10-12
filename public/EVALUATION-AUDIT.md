# WOLVGUARD — audit against the supplied 100-point rubric
Date: 13 October 2026 (Asia/Calcutta)

## Outcome
The previous version did NOT fully cover the rubric: its live social module was unavailable, no logo comparison was implemented, and there was no judge-facing presentation. This revision adds live Bluesky social search, actual image comparison, exact official exclusions for both providers, and a presentation/validation module.

No numerical score is self-awarded. “Implemented” means demonstrable prototype behavior, not perfect detection accuracy, platform-wide coverage, or guaranteed acceptance by judges.

| Criterion | Weight | Current coverage | Evidence |
|---|---:|---|---|
| Social Media Monitoring | 30% | Implemented for live Bluesky public profiles | searchActors API; stable DID resolution; name/token/lookalike, description, verified account metadata, optional avatar comparison; exact verified DID exclusion |
| App Store Monitoring | 30% | Implemented for live Apple App Store | Search API; actual source IDs/URLs; name/description/publisher/logo signals; exact verified app ID exclusion |
| Brand Profile | 15% | Implemented in local workspace | validated names/HTTPS links, optional logo upload, provider-specific official assets, recorded evidence, verification and revocation controls |
| User Experience | 15% | Implemented with testable workflows | responsive UI, search/filter/pagination, safe failures, cancel, source links, review notes, exports, alerts, empty states, persistent source/data-mode banners |
| Presentation & Demo | 10% | Implemented | six-slide presentation, timed presenter notes, rubric audit, nine runnable synthetic validation checks |

## Important limits
- YouTube requires an authorized API key; Instagram, Facebook, X and Google Play are not claimed as integrated. Only actually accessible relevant public providers are enabled.
- Public keyword search is bounded and may omit candidates. Similarity is not proof of fraud; no automatic accusation/report/removal.
- dHash + RGB is a basic image heuristic. It can confuse visually similar icons and miss transformed logos. Unavailable/blocked images are explicitly unavailable.
- Independent ownership evidence is entered by the user. Manual verification is not a third-party attestation. Exact provider IDs are excluded only after this explicit step.
- Browser-local persistence is not secure multi-user cloud storage. Local review history is not tamper-proof. Email and authenticated company accounts are unconfigured.
- Provider rate limits, cache use, failures, returned timestamps and partial results remain visible.

## Test evidence
The repository includes scoring/image tests, provider response/error tests, a real-provider browser workflow test, mobile checks and a broader control-interaction audit. Failure/empty-response fixtures are explicitly tests and not labelled real upstream observations. Run `npm test` and the scripts under `tests/` against the running website to reproduce.

## External API documentation consulted
- https://endpoints.bsky.app/#bluesky-app — public AppView reads and actor search/profile routes.
- https://performance-partners.apple.com/search-api — software search, country/limit parameters, caching and quota guidance.

## Recorded validation results for this revision
- 30 automated scoring, exclusion, provider, image and fetch-safety tests passed.
- Static audit found 98 button definitions in the main application and live/evaluation views, with zero unwired button definitions. Static wiring is not proof of every possible behavioral state.
- 31 grouped browser workflows passed (23 live/control groups, 8 landing/demo groups), with no captured uncaught page exceptions.
- Real Apple and Bluesky API responses and source-image fingerprints were used in the live tests. Forced failure/cancel cases and manual-attestation inputs were explicitly isolated test fixtures.
- Mobile layout and navigation were checked at 390px, and a separate no-WebGL browser check preserved landing-page and live-workspace access.
- Detailed results are downloadable as `QA-RESULTS.json` from Demo & Evaluation.
