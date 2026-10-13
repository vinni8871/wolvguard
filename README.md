# WOLVGUARD — Digital Risk Protection
**Team WOLVANT · “See the Impersonation. Stop the Threat.”**

[![Status](https://img.shields.io/badge/Round_1-MVP_Completed-teal?style=for-the-badge)](https://github.com/vinni8871/wolvguard)
[![Round 2](https://img.shields.io/badge/Round_2-Active_Development-orange?style=for-the-badge)](https://github.com/vinni8871/wolvguard)
[![Tech Stack](https://img.shields.io/badge/Stack-React_19_|_TypeScript_|_Node.js_|_Supabase-blue?style=for-the-badge)](https://github.com/vinni8871/wolvguard)
[![AI Assistant](https://img.shields.io/badge/AI-Gemini_Powered-yellow?style=for-the-badge)](https://github.com/vinni8871/wolvguard)

---

## ⚡ Quick Start

```sh
# 1. Install dependencies
npm install

# 2. Build frontend
npm run build

# 3. Start unified production server
npm start
```

* **Live App**: [https://wolvguard.vercel.app](https://wolvguard.vercel.app)
* **Development Mode**: `npm run dev:api` (Port 3001) + `npm run dev` (Port 5173)

### 🌐 Deploying to Vercel
1. Push this repository to GitHub.
2. In Vercel, import the repository (Framework Preset: **Vite**).
3. Set the Environment Variables in Vercel Settings -> Environment Variables:
   * `VITE_SUPABASE_URL`
   * `VITE_SUPABASE_PUBLISHABLE_KEY`
   * `YOUTUBE_API_KEY`
   * `GEMINI_API_KEY`
   * `GEMINI_MODEL` (Optional, leave blank or set to `gemini-2.5-flash`)
4. Deploy! Vercel automatically serves the frontend static build from `dist/` and runs all `/api/*` endpoints (YouTube scan, Gemini chat assistant, provider health) via Vercel Serverless Functions in `api/`.

---

## 📌 Executive Summary: What We Have Built & Current Status

WOLVGUARD is a proactive brand protection platform designed to identify, assess, and dismantle unauthorized impersonation threats across social and digital channels. 

### 🛡️ What Is Fully Working & Implemented (Completed)
1. **Brand Registration & Profile Setup**:
   * Brands register their official identity: Name, Website, Description, and Reference Logo.
   * **Privacy-First Logo Normalization**: Brand logos are hashed client-side in the browser via HTML5 Canvas (64-bit dHash + mean RGB) — original brand images never leak or leave the browser unnecessarily.
   * **Verified Asset Exclusions**: Register official YouTube channel IDs and social handles so legitimate brand identities are never falsely flagged.
2. **Live YouTube Monitoring**:
   * Direct integration with YouTube Data API v3 (`search.list` by `type=channel`).
   * Fetches real channel IDs, titles, descriptions, and high-resolution avatars.
   * Real-time comparison against the registered brand identity.
3. **Transparent 4-Signal Risk Scoring Engine**:
   * **Name Similarity (35%)**: Normalized Levenshtein distance with token substring matching.
   * **Visual Logo Similarity (30%)**: 64-bit difference hash (dHash) + RGB average difference via server-side `sharp`.
   * **Description Matching (15%)**: Shared-token cosine similarity across profile descriptions.
   * **Publisher Difference (20%)**: Flags discrepancies against verified official publishers.
   * Dynamic severity categorization: **Critical (85+)**, **High (60+)**, **Medium (30+)**, and **Low (<30)**.
4. **AI Threat Assistant (Gemini-Powered)**:
   * Embedded conversational AI backed by Google Gemini (`/api/chat`).
   * Explains multi-factor risk scores, breaks down why specific accounts are flagged, and suggests immediate defense steps.
5. **Supabase Cloud Backend & Authentication**:
   * Full user authentication (Email + Password signup and login).
   * PostgreSQL database secured with strict **Row Level Security (RLS)** policies.
   * Automatic cloud persistence across `brands`, `brand_assets`, `scan_runs`, `candidates`, `findings`, `finding_reviews`, and `notifications`.
6. **Robust Security & Infrastructure**:
   * Server-side API key protection (credentials never touch the browser).
   * Strict SSRF guardrails on image fetching (only trusted CDN hosts, zero internal IP access, redirects blocked).
   * Unified single-port server (`server/index.mjs`) with caching, rate limits, and zero synthetic fallback data.
7. **Forensic PDF Export Engine**:
   * One-click courtroom-ready and takedown-compliant PDF reports (`lib/scan-report.ts` via `jsPDF`) for full scan records and single-candidate evidence dossiers.

---

## 🎯 Round 2 Priority Focus: App Monitoring & Findings/Investigations

While Round 1 achieved a functioning MVP with live social monitoring, AI guidance, and cloud persistence, **App Monitoring** and deep **Findings & Investigations** are actively being completed in **Round 2** for peak efficiency:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              WOLVGUARD ROADMAP                              │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ COMPLETED (MVP / ROUND 1)            │ TARGET FOR ROUND 2                   │
├──────────────────────────────────────┼──────────────────────────────────────┤
│  ✅ YouTube Channel Surveillance      │  🚀 Dual App Store Scanner           │
│  ✅ Gemini AI Risk Assistant          │     (Google Play + Apple Public API) │
│  ✅ Brand Registration & Canvas Hash │  🚀 Deep Investigation Cases         │
│  ✅ 4-Signal Multi-Factor Risk Score │     (Timeline, SLA, Analyst Notes)   │
│  ✅ Supabase Auth & Cloud RLS DB     │  🚀 1-Click Takedown Generator       │
│  ✅ Clean UI & Dark/Light Theme      │     (Pre-filled DMCA / Abuse forms)  │
│  ✅ Forensic PDF Evidence Export     │  🚀 Typosquatting / Homoglyph Engine │
│  ✅ 39/39 Automated Tests Passing    │  🚀 Unattended Background Cron Scans │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

### 1. 📱 App Monitoring (Round 2 Implementation)
* **Current Status**: The initial Apple Ads API integration required specialized private keys and ad account permissions that restricted seamless public scans.
* **Round 2 Solution**:
  * Build a lightweight, reliable **Dual Store Scanner** covering both the **Apple App Store** and **Google Play Store**.
  * Use direct store index APIs/scrapers to capture real bundle IDs (`com.example.app`), developer account names, download brackets, and app icons without heavy ad-network authentication roadblocks.
  * Compare app icons against registered brand logos using the existing `sharp` dHash64 visual engine.

### 2. 🔍 Findings & Investigations (Round 2 Implementation)
* **Current Status**: Current candidates can be reviewed (*Needs Review*, *Under Review*, *Confirmed*, *Dismissed*) and exported to PDF, but deeper investigation workflows need enterprise depth.
* **Round 2 Solution**:
  * **Unified Case Management**: Group multiple related lookalike findings (e.g., an unauthorized app + matching YouTube channel) into a single unified **Threat Actor Case**.
  * **Automated Takedown Packager**: Generate platform-specific, pre-filled intellectual property infringement reports for:
    * Google Play Developer Takedown Portal
    * Apple App Store Trademark Infringement Form
    * YouTube Brand Impersonation Abuse Desk
  * **Analyst Audit Timeline**: Chronological event logs tracking status changes, investigator comments, and score recalculations.

---

## 📂 Project Directory Structure

```
c:\TEAM-WOLVANTT
├── components/
│   ├── live/
│   │   ├── LiveWorkspace.tsx        # Main monitoring dashboard & review station
│   │   ├── types.ts                 # Type definitions (Brands, Candidates, Scans)
│   │   └── ...                      # Navigation, stat cards, and candidate drawers
│   └── ui/                          # UI primitives (Buttons, Dialogs, Logos)
├── lib/
│   ├── detection.ts                 # Similarity algorithms (Levenshtein, Cosine)
│   ├── live-detection.ts            # 4-signal heuristic scorer & severity tiers
│   ├── scan-report.ts               # jsPDF evidence & audit report generator
│   ├── scan-report.test.ts          # Unit tests for PDF generation
│   ├── image-signature.ts           # Browser-side canvas image hashing
│   └── supabase.ts                  # Supabase client, auth, and database sync
├── server/
│   ├── index.mjs                    # Production HTTP server + API router
│   ├── dev.mjs                      # Local development API runner (Port 3001)
│   ├── providers.mjs                # YouTube, Apple Ads, and Bluesky adapters
│   ├── assistant.mjs                # Gemini conversational API proxy
│   └── images.mjs                   # SSRF-guarded image fetcher & Sharp dHash64
├── supabase/
│   ├── schema.sql                   # Full PostgreSQL schema with RLS policies
│   └── migrations/                  # Incremental DB migrations
├── tests/
│   ├── full-audit.mjs               # End-to-end browser audit workflow
│   └── demo-controls.mjs            # UI regression tests
├── App.tsx                          # Root router, auth states, and navigation shell
├── styles.css                       # Responsive stylesheets, layout tokens, dark theme
├── vite.config.ts                   # Vite configuration with API proxy
└── package.json                     # Scripts and project dependencies
```

---

## 🧪 Testing & Validation

```sh
npm test
```
* **39 Total Tests Passed** (22 frontend/lib tests + 17 server tests).
* Covers Levenshtein boundaries, image normalization, SSRF protection, YouTube mapping, Gemini proxy bounds, and PDF report creation.

---

## 🎯 Short & Crispy Summary

> **Round 1 Accomplishments:**  
> We registered brands, fingerprinted logos securely in the browser, connected live YouTube channel monitoring, built an explainable 4-signal risk engine, added a Gemini AI assistant, built a clean UI with Supabase authentication & persistence, and implemented exportable PDF dossiers.
>
> **Round 2 Mission:**  
> Seamlessly complete **App Monitoring** (Apple + Google Play) and upgrade **Findings & Investigations** into full case management with 1-click takedown automation! 🚀
