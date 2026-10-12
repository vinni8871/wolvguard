# WOLVGUARD — 3-minute judge demonstration
Team WOLVANT · See the Impersonation. Stop the Threat.

## 0:00–0:25 — Problem & boundaries
Brand impersonation erodes trust across social media and app stores. WOLVGUARD discovers public candidates, compares them with registered brand assets, and produces explainable review leads. It never calls similarity proof of fraud.

## 0:25–0:55 — Official identity first (Brand Profile: 15%)
Open Brand Profiles. Add a public brand name, optional official website, description, and an image file. Register actual official Apple and Bluesky URLs. Resolving a Bluesky URL returns a stable DID, not an ownership claim. Record an independent verification method before excluding an identity. A known official account is then excluded from current findings and alerts.

## 0:55–1:35 — Real sources (Social: 30%, Apps: 30%)
Run a bounded Bluesky scan and an Apple scan. Show provider, source identifier, source URL, region, and fetched timestamp. If repeated within 5 minutes, explain the cache label. Explain that search is limited, not full platform surveillance. Both source integrations have been tested against their actual public APIs.

## 1:35–2:10 — Explainability and review
Open a candidate. Show name/token/lookalike evidence, description-token overlap, account/publisher difference only where an official reference exists, and computed logo similarity only when image comparison succeeds. Unavailable signals stay unavailable. Show the source page. Add an Under Review note and export evidence. Do not confirm impersonation of a real person/company just for the demonstration.

## 2:10–2:40 — Reliability (UX: 15%)
Show filtering, search, pagination, scan history and the local alert center. Demonstrate cancel or a failed-request test, explaining that no synthetic replacement candidates appear. Explain browser-local storage, exports and retention. Company cloud authentication and email delivery are not configured.

## 2:40–3:00 — Validation (Presentation: 10%)
Open Demo & Evaluation. Run the nine synthetic rubric checks. These cover verified official exclusions, provider ID isolation, name-only risk cap, lookalike names, multi-signal matches, real image computation and unavailable-image behavior. Synthetic checks never enter the live results.

## Questions to anticipate
- Which platforms? Live Bluesky and Apple App Store; no unsupported platform claim.
- Which AI? Explainable deterministic heuristics today, not a fabricated model prediction.
- Logos? dHash-64 plus mean RGB, 70/30 mix, on normalized 9×8 pixels. An approximate visual signal; not robust semantic logo understanding.
- Verified? Explicit manual evidence; not automated ownership proof.
- Is it production ready? Functional local prototype. No shared authenticated tenant storage, tamper-proof audit log or configured email delivery.
- Can it get 100 points? The five weighted areas have demonstrable coverage, but grading and real-world accuracy are not guaranteed.
