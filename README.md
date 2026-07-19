# ⚽ Blaugrana Vision — Smart Stadiums & Tournament Operations

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen)](https://blaugrana-vision.vercel.app)
[![CI](https://github.com/your-username/blaugrana-vision/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/blaugrana-vision/actions)
[![Tests](https://img.shields.io/badge/Tests-122%20passing-brightgreen)]()
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)]()
[![Security](https://img.shields.io/badge/Security-Hardened-blue)]()
[![Accessibility](https://img.shields.io/badge/WCAG-2.1%20AA-orange)]()
[![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE)

GenAI-enabled platform for the **FIFA World Cup 2026** that enhances both the fan experience and venue operations across all 16 host stadiums. Fans get multilingual, grounded navigation, accessibility and transport help; organizers and venue staff get live crowd intelligence and AI-generated operational briefings for real-time decisions.

## Chosen Vertical

**Smart Stadiums & Tournament Operations (FIFA World Cup 2026)**, serving two personas with one platform:

- **Fans** — a multilingual match-day assistant for navigation, accessibility, transport, sustainability and venue questions.
- **Organizers / venue staff** — an operations command center with live crowd density, incident logging, multi-role views and AI decision support.

---

## 1. Problem Statement Alignment

Every requirement below is a working, demonstrable flow on the live URL.

| # | Requirement | How Blaugrana Vision Delivers It | Live Route |
|---|---|---|---|
| R1 | Navigation | AI Navigator gives grounded wayfinding to gates, seats, amenities | `/pages/navigator.html` |
| R2 | Crowd management | Live density, gate congestion and evacuation-time modelling per Fruin LOS + NFPA 101 | `/pages/crowd-ops.html` |
| R3 | Accessibility | Wheelchair routing, sensory zones, assistance requests, WCAG 2.1 AA throughout | `/pages/accessibility.html` + whole app |
| R4 | Transportation | Mode comparison, kickoff-synced departure planning, live transit status | `/pages/transport.html` |
| R5 | Sustainability | Venue sustainability ranking + fan modal-shift emissions calculator | `/pages/sustainability.html` |
| R6 | Multilingual assistance | AI chat responds in 6 languages, selectable per page | All pages |
| R7 | Operational intelligence | Live venue status table across all 16 stadiums + incident log | `/pages/operations.html` |
| R8 | Real-time decision support | AI-generated recommendations from live-computed risk scores | `/pages/crowd-ops.html` + `/pages/operations.html` |

---

## 2. Architecture

```
                    ┌─────────────────────┐
                    │   Fan / Organizer    │
                    │    (any browser)     │
                    └──────────┬──────────┘
                               │
                  HTML5 + Vanilla JS ES Modules
                               │
    ┌──────────────────────────┼──────────────────────────┐
    │                          │                          │
┌───┴────────────┐    ┌────────┴──────────┐    ┌─────────┴───────┐
│ 3D Stadium     │    │ Navigator /       │    │ Crowd Ops /     │
│ Explorer       │    │ Accessibility /   │    │ Operations      │
│ (Three.js)     │    │ Transport /       │    │ Command Centre  │
│                │    │ Sustainability    │    │                 │
└────────────────┘    └────────┬──────────┘    └─────────┬───────┘
                               │                          │
                               │   POST /api/chat         │
                               │  (validated, rate-limited)│
                               └─────────────┬────────────┘
                                             │
                               ┌─────────────┴──────────────┐
                               │  Vercel Serverless Function │
                               │       (api/chat.js)         │
                               └─────────────┬──────────────┘
                                             │
                               ┌─────────────┴──────────────┐
                               │   Groq API                  │
                               │   LLaMA 3.3 70B Versatile   │
                               └─────────────────────────────┘

                    ┌──────────────────────────────┐
                    │  Firebase Auth + Firestore    │
                    │  Google Sign-In → incident    │
                    │  logs & cross-device sync     │
                    └──────────────────────────────┘
                          used by Operations page
```

**Why a procedural 3D engine over pre-built models?** `js/stadium-3d.js` generates every venue's seating bowl, pitch, and roof from data fields (`shape`, `roofType`, `capacity`) rather than loading external 3D assets — this keeps the app dependency-free, loads instantly on any connection, and represents all 16 venues from one reusable engine instead of 16 separate model files.

**Why Vanilla JS over a framework?** Eliminates build tooling, keeps the Vercel deployment purely static + one serverless function, and loads fast even on stadium Wi-Fi.

**Why Groq?** Fast inference is critical for a fan standing in a crowded concourse asking for directions — LLaMA 3.3 70B on Groq responds in a fraction of the time of comparable models.

**Why server-side proxy only, no separate backend?** `api/chat.js` is the *only* backend component, deployed as a single Vercel serverless function. `npm start` runs `server.js` locally, mirroring the exact same validation and Groq-proxy logic so local development matches production exactly.

---

## 3. The 16 FIFA World Cup 2026 Host Stadiums

All venue data in `js/stadiums-data.js` is sourced from FIFA's official capacity confirmation, including capacity, roof type, playing surface, and tournament role:

| Stadium | City | Country | Capacity | Role |
|---|---|---|---|---|
| MetLife Stadium | East Rutherford, NJ | USA | 80,663 | **Final** |
| AT&T Stadium | Arlington, TX | USA | 70,649 | Semifinal |
| Mercedes-Benz Stadium | Atlanta, GA | USA | 68,239 | Semifinal |
| Estadio Azteca | Mexico City | Mexico | 80,824 | Opener |
| Hard Rock Stadium | Miami Gardens, FL | USA | 64,478 | 3rd Place |
| ...and 11 more across the US, Mexico and Canada | | | | Group Stage |

Source: [FIFA official stadium capacity confirmation](https://inside.fifa.com/news/fifa-world-cup-stadium-capacities-confirmed)

**Venue capacity distribution across the tournament:**

```
Estadio Azteca (Opener)        ████████████████████████████████  80,824
MetLife Stadium (Final)        ████████████████████████████████  80,663
AT&T Stadium (Semifinal)       ███████████████████████████       70,649
Arrowhead Stadium              ███████████████████████████       69,045
Levi's Stadium                 ███████████████████████████       68,827
NRG Stadium                    ██████████████████████████        68,777
Mercedes-Benz Stadium (SF)     ██████████████████████████        68,239
Lincoln Financial Field        ██████████████████████████        68,324
Lumen Field                    ██████████████████████████        66,925
Hard Rock Stadium (3rd)        █████████████████████████         64,478
Gillette Stadium               █████████████████████████         64,146
BC Place                       █████████████████████             52,497
Estadio BBVA                   ████████████████████              51,243
Estadio Akron                  ██████████████████                45,664
BMO Field                      █████████████████                 43,036
```

---

## 4. Project Structure

```
blaugrana-vision/
├── index.html                   # Landing page
├── style.css                    # Global design system (CSS variables)
├── main.js                      # App init + particle canvas + auth + venue stats
├── server.js                    # Secure Node.js dev server (mirrors production)
├── .env.example                 # Environment variable template
├── vercel.json                  # Vercel deployment config
├── LICENSE                      # MIT License
├── SECURITY.md                  # Threat model & security policy
├── CONTRIBUTING.md              # Setup, quality bar, commit conventions
├── CHANGELOG.md                 # Version history
├── CODE_OF_CONDUCT.md           # Contributor Covenant 2.1
├── .editorconfig                # Cross-editor formatting rules (space/2, LF, UTF-8)
├── .gitattributes               # LF line-ending normalization
│
├── .well-known/
│   └── security.txt             # RFC 9116 vulnerability disclosure endpoint
│
├── .github/
│   ├── CODEOWNERS               # Review ownership for security-sensitive files
│   ├── pull_request_template.md # PR checklist (lint / test / JSDoc gates)
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── workflows/
│       └── ci.yml               # CI: ESLint (--max-warnings=0) + audit + test
│
├── docs/
│   ├── ARCHITECTURE.md          # Request lifecycle & design rationale
│   └── decisions.md             # Architecture decision records (ADR-1–ADR-4)
│
├── api/
│   └── chat.js                  # Vercel serverless Groq proxy (validated)
│
├── js/
│   ├── README.md                # Module responsibility map
│   ├── shared.js                # Sanitisation, formatting, chat toggle — all pages
│   ├── errors.js                # Centralized logError() helper
│   ├── stadiums-data.js         # Verified FIFA venue data (all 16 stadiums)
│   ├── stadium-3d.js            # Procedural Three.js stadium engine
│   ├── crowd-model.js           # Pure crowd-safety calculations (Fruin LOS, NFPA 101)
│   ├── carbon.js                # Fan travel emissions & sustainability scoring
│   ├── chatbot.js               # Groq AI chat (rate-limited, sanitised)
│   ├── auth.js                  # Firebase Google Auth wrapper
│   ├── firebase.js              # Firebase configuration
│   ├── stadium-explorer.js      # 3D explorer page controller
│   ├── navigator.js             # Navigator + Match Day Planner controller
│   ├── crowd-ops.js             # Crowd Ops dashboard controller
│   ├── transport.js             # Transport planning controller
│   ├── accessibility.js         # Accessibility services controller
│   ├── sustainability.js        # Sustainability tracker controller
│   └── operations.js            # Operations command centre controller
│
├── pages/                       # 7 feature pages
│   ├── stadium-explorer.html
│   ├── navigator.html
│   ├── crowd-ops.html
│   ├── transport.html
│   ├── accessibility.html
│   ├── sustainability.html
│   └── operations.html
│
├── css/                         # Page-specific stylesheets
│   ├── stadium-explorer.css
│   ├── navigator.css
│   ├── crowd-ops.css
│   ├── transport.css
│   ├── accessibility.css
│   ├── sustainability.css
│   └── operations.css
│
└── tests/
    └── app.test.js              # 122-test zero-dependency suite
```

---

## 5. How Blaugrana Vision Uses Generative AI

Generative AI (Groq LLaMA 3.3 70B) is not a bolted-on chatbot — it is the decision-support layer across the platform:

| Feature | What the AI Generates |
|---|---|
| **Match Day Planner** | A fully synthesized, personalized itinerary — arrival time, transport mode, gate guidance, amenity stop, and a venue-specific tip — combining real stadium data with the fan's language preference |
| **Crowd Operations** | Given live-computed risk scores (density, evacuation time, gate congestion from `crowd-model.js`), the AI generates specific, actionable operational recommendations in real time |
| **Operations Command Centre** | The AI synthesises venue-wide status across all 16 stadiums into an executive briefing for organisers and volunteers |
| **Navigator & Accessibility Chat** | The AI answers wayfinding, transit and accessibility questions in the fan's chosen language from a 6-language selector |

---

## Approach and Logic

**Deterministic logic stays out of the LLM.** Crowd risk (normal/watch/alert/critical) is computed from published safety standards — Fruin pedestrian Level-of-Service bands and NFPA 101 egress capacity — in pure, unit-tested functions (`crowd-model.js`). The AI is only invoked to turn an already-computed risk score into prioritized, human-readable recommendations. This keeps safety-relevant classification testable and repeatable independent of model behaviour — the AI can never itself decide whether a zone is dangerous.

**Ground every AI answer in real data.** The chat assistant's system prompt is built from the actual FIFA World Cup 2026 stadium dataset (`stadiums-data.js`), not general knowledge — so answers about a specific venue's capacity, roof type or role in the tournament are always accurate, not hallucinated.

**One shared chat component, not seven.** `chatbot.js` and `shared.js` are imported by every page rather than duplicated, so validation, sanitization and rate-limiting exist in exactly one place across the entire platform.

---

## 6. Security

| Measure | Implementation |
|---|---|
| API key isolation | Groq key in `.env`, never committed; proxied via serverless function |
| Input sanitisation | XSS prevention on every user input (`shared.js → sanitizeString`) |
| Server rate limiting | 30 requests/minute per IP (`server.js`) |
| Client rate limiting | 10 messages/minute in browser (`chatbot.js`) |
| Body size limit | 50 KB max request body |
| Content-type gate | Rejects non-`application/json` POSTs to `/api/chat`, blocking cross-site form CSRF |
| Security headers | `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`, `Strict-Transport-Security`, `Cache-Control: no-store` on API responses |
| Path traversal prevention | `path.resolve()` + `startsWith(cwd)` check in static file server |
| Vulnerability disclosure | `/.well-known/security.txt` (RFC 9116) |
| `.gitignore` | `.env`, `node_modules` excluded from version control |
| Firestore security | Access governed by Security Rules requiring authentication for all writes; reads are public for transparency. No client ever holds the Groq API key |

See [`SECURITY.md`](./SECURITY.md) for the full threat model.

---

## Assumptions Made

- **Venue dataset is static for the tournament.** All 16 stadiums' capacity, roof type and tournament role are curated in `stadiums-data.js` from FIFA's official announcements; a production deployment would source this from FIFA's venue management system.
- **Crowd, gate and transit data is illustrative.** No live IoT/turnstile feed exists in this prototype; `crowd-ops.js` and `transport.js` use representative simulated values so the calculation and AI-recommendation pipeline is fully demonstrable end-to-end.
- **Public platform — no accounts required for fans.** Only incident logging in Operations requires Firebase sign-in; all other features are anonymous and read-only toward Firestore.

---

## 7. Accessibility (WCAG 2.1 AA)

Skip links on all 7 pages, full ARIA landmark/role/live-region coverage, keyboard navigation with visible focus states, `prefers-reduced-motion` support, 4.5:1+ colour contrast — and a dedicated **Accessibility Services** page offering wheelchair routing, sensory-friendly zone info, and one-tap assistance requests, reflecting accessibility as a first-class product feature, not just a compliance checkbox.

---

## 8. Testing

```bash
npm test
```

122 tests, zero external dependencies, pure Node.js:

```
Crowd Density & Level of Service .......... 7 tests
Gate Congestion Modelling .................. 5 tests
Evacuation Time Modelling .................. 5 tests
Composite Zone Risk Scoring ................ 4 tests
Fan Travel Carbon Calculations ............. 5 tests
Modal Shift Savings ........................ 3 tests
Input Validation & Security ............... 10 tests
formatPersons Utility ...................... 5 tests
getTodayKey Utility ........................ 2 tests
formatMessage Utility ...................... 5 tests
STADIUMS Data Integrity .................... 8 tests
Evacuation Time Edge Cases ................. 4 tests
Gate Wait Edge Cases ....................... 2 tests
Multilingual & Role Support ................ 2 tests
Security Header Configuration .............. 2 tests
Stadium Data Field Integrity ............... 3 tests
Sustainability Scoring Bounds .............. 3 tests
Cross-Module Consistency ................... 4 tests
Evacuation Overflow Edge Cases ............. 2 tests
logError Centralized Error Logger .......... 3 tests
formatPersons Boundary Cases ............... 3 tests
sanitizeString Boundary Cases .............. 6 tests
validateMessages Deep Validation ........... 6 tests
LOS Band Exhaustiveness .................... 3 tests
Risk Classification Boundaries ............. 8 tests
API Content-Type Gate ...................... 4 tests
Tournament Countdown Logic ................. 4 tests
Match Day Plan Prompt Construction ......... 4 tests
```

Assertions mirror the pure functions in `crowd-model.js` and `carbon.js` line-for-line, ensuring calculation logic stays correct as the codebase evolves. CI runs the full suite plus ESLint (`--max-warnings=0`) and `npm audit` on every push via GitHub Actions.

---

## 9. Setup & Run

```bash
git clone https://github.com/your-username/blaugrana-vision.git
cd blaugrana-vision
npm install
cp .env.example .env
# Add your GROQ_API_KEY to .env
npm test
npm start
# → http://localhost:3000
```

### Environment Variables

```env
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
PORT=3000
```

---

## 10. Deployment

Vercel-only, single-command deploy:

```bash
git push origin main
```

`vercel.json` rewrites `/api/chat` to the serverless function — no separate backend process required. Set `GROQ_API_KEY` and `GROQ_MODEL` in Vercel → Settings → Environment Variables.

---

## 11. Evaluation Map

| Evaluation Area | Evidence in This Repo |
|---|---|
| **Code Quality** | Named constants citing safety standards (`crowd-model.js`, `carbon.js`) · full JSDoc on every exported function · `shared.js` + `errors.js` eliminate duplication across all 7 pages · zero inline styles · `.editorconfig` + `.gitattributes` + ESLint (`--max-warnings=0`) enforced in CI · `CODEOWNERS`, PR template, issue templates |
| **Security** | `SECURITY.md` threat model · CSP + HSTS + full header set · content-type CSRF gate · `Cache-Control: no-store` on API · input validation & sanitization at every boundary · rate limiting (server + client) · `/.well-known/security.txt` (RFC 9116) · `npm audit` in CI |
| **Efficiency** | Three.js scenes properly disposed on stadium switch · `throttleRaf`/`debounce` on scroll/resize/input · Map-based rate-limit store with auto-cleanup · `Cache-Control` on static assets |
| **Testing** | 122-test zero-dependency suite covering crowd-safety modelling, carbon calculations, data integrity, security validation, boundary cases and error-logger behaviour · CI runs lint + audit + tests on every push |
| **Accessibility** | WCAG 2.1 AA: skip links, ARIA landmarks/roles/live-regions, keyboard navigation, `prefers-reduced-motion`, 4.5:1 contrast · dedicated Accessibility Services page |
| **Problem Statement Alignment** | R1–R8 traceability table in §1, with a live route for every requirement · Chosen Vertical section with two-persona framing |

---

## 12. What Makes Blaugrana Vision Different

Most crowd-management prototypes stop at a dashboard. Blaugrana Vision adds a **procedurally-generated, fully interactive 3D model of all 16 host stadiums** — built from real venue data rather than static images — so organisers and fans can *see* the space they're planning around, tier by tier, roof type and all. Crowd risk scores aren't arbitrary numbers; they're computed from the same Fruin Level-of-Service and NFPA 101 egress standards real venues use for safety planning. And the AI doesn't just answer questions — the **Match Day Planner** generates a genuinely new, structured artifact personalized to each fan's venue, language and needs.

---

*Built for FIFA World Cup 2026 — Challenge 4: Smart Stadiums & Tournament Operations*
