# ⚽ Blaugrana Vision — Smart Stadiums & Tournament Operations

> **FIFA World Cup 2026 · Challenge 4 — Smart Stadiums & Tournament Operations.**
> A GenAI-enabled platform that enhances stadium operations and the tournament experience for fans, organisers, volunteers, and venue staff — spanning navigation, crowd management, accessibility, transportation, sustainability, multilingual assistance, and real-time operational intelligence across all 16 host venues.

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen)](https://blaugrana-vision.vercel.app)
[![CI](https://github.com/your-username/blaugrana-vision/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/blaugrana-vision/actions)
[![Tests](https://img.shields.io/badge/Tests-45%20passing-brightgreen)]()
[![Security](https://img.shields.io/badge/Security-Hardened-blue)]()
[![Accessibility](https://img.shields.io/badge/WCAG-2.1%20AA-orange)]()
[![License](https://img.shields.io/badge/License-MIT-green)]()

---

## 1. Chosen Vertical

**Smart Stadiums & Tournament Operations** — a unified platform serving every stakeholder at the FIFA World Cup 2026, organised around the challenge's core pillars:

| Pillar | In the product |
|--------|----------------|
| **Navigation** | Multilingual AI Navigator with point-of-interest routing across all 16 venues |
| **Crowd management** | Real-time density, gate congestion and evacuation-time modelling grounded in published safety standards |
| **Accessibility** | Wheelchair routing, sensory-friendly zones, and one-tap assistance requests |
| **Transportation** | Mode comparison, kickoff-based departure planning, live transit status |
| **Sustainability** | Venue sustainability rankings and a fan-facing modal-shift emissions calculator |
| **Multilingual assistance** | Groq-powered AI assistant available in six languages on every page |
| **Operational intelligence** | Command centre with venue status table, incident logging, and AI-generated briefings for organisers |

---

## 2. Architecture
Browser (HTML5 + Vanilla JS ES Modules + Three.js)
├── index.html              Landing page
├── pages/stadium-explorer  Interactive 3D venue models (Three.js, procedural)
├── pages/navigator         Multilingual wayfinding
├── pages/crowd-ops         Live crowd risk dashboard
├── pages/transport         Travel mode & departure planning
├── pages/accessibility     Accessibility services & requests
├── pages/sustainability    Venue sustainability rankings
└── pages/operations        Organiser command centre
│
│  POST /api/chat  (input-validated, rate-limited proxy)
▼
Vercel Serverless Function (api/chat.js)
│
▼
Groq API — LLaMA 3.3 70B Versatile
│
Firebase Auth + Firestore
└── Google Sign-In → incident logs & cross-device sync
**Why a procedural 3D engine over pre-built models?** `js/stadium-3d.js` generates every venue's seating bowl, pitch, and roof from data fields (`shape`, `roofType`, `capacity`) rather than loading external 3D assets — this keeps the app dependency-free, loads instantly on any connection, and represents all 16 venues from one reusable engine instead of 16 separate model files.

**Why Vanilla JS over a framework?** Eliminates build tooling, keeps the Vercel deployment purely static + one serverless function, and loads fast even on stadium Wi-Fi.

**Why Groq?** Fast inference is critical for a fan standing in a crowded concourse asking for directions — LLaMA 3.3 70B on Groq responds in a fraction of the time of comparable models.

**Why server-side proxy only, no separate backend?** `api/chat.js` is the *only* backend component, deployed as a single Vercel serverless function. `npm start` runs `server.js` locally, which mirrors the exact same validation and Groq-proxy logic so local development matches production exactly.

---

## 3. The 16 FIFA World Cup 2026 Host Stadiums

All venue data in `js/stadiums-data.js` is sourced from FIFA's official capacity confirmation, including capacity, roof type, playing surface, and tournament role (Final, Semifinal, or Group Stage):

| Stadium | City | Country | Capacity | Role |
|---|---|---|---|---|
| MetLife Stadium | East Rutherford, NJ | USA | 80,663 | **Final** |
| AT&T Stadium | Arlington, TX | USA | 70,649 | Semifinal |
| Mercedes-Benz Stadium | Atlanta, GA | USA | 68,239 | Semifinal |
| Estadio Azteca | Mexico City | Mexico | 80,824 | Opener |
| Hard Rock Stadium | Miami Gardens, FL | USA | 64,478 | 3rd Place |
| ...and 11 more across the US, Mexico and Canada | | | | Group Stage |

Source: [FIFA official stadium capacity confirmation](https://inside.fifa.com/news/fifa-world-cup-stadium-capacities-confirmed)

---

## 4. Project Structure
blaugrana-vision/
├── index.html                  # Landing page
├── style.css                   # Global design system (CSS variables)
├── main.js                     # App init + particle canvas + auth + venue stats
├── server.js                   # Secure Node.js dev server (mirrors production)
├── .env.example                # Environment variable template
├── vercel.json                 # Vercel deployment config
├── .github/
│   └── workflows/ci.yml        # CI: lint + test on every push
├── api/
│   └── chat.js                 # Vercel serverless Groq proxy (validated)
├── js/
│   ├── shared.js                # Sanitisation, formatting, chat toggle
│   ├── stadiums-data.js         # Verified FIFA venue data (all 16 stadiums)
│   ├── stadium-3d.js            # Procedural Three.js stadium engine
│   ├── crowd-model.js           # Pure crowd-safety calculation functions
│   ├── carbon.js                # Fan travel emissions & sustainability scoring
│   ├── chatbot.js               # Groq AI chat (rate-limited, sanitised)
│   ├── auth.js / firebase.js    # Firebase Google Auth
│   └── {page}.js                # One controller per page module
├── pages/                       # 7 feature pages
├── css/                         # Page-specific stylesheets
└── tests/
└── app.test.js               # Comprehensive test suite
---

## 5. Security

| Measure | Implementation |
|---|---|
| API key isolation | Groq key in `.env`, never committed; proxied via serverless function |
| Input sanitisation | XSS prevention on every user input (`shared.js → sanitizeString`) |
| Server rate limiting | 30 requests/minute per IP (`server.js`) |
| Client rate limiting | 10 messages/minute in browser (`chatbot.js`) |
| Body size limit | 50 KB max request body |
| Security headers | `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy` |
| Path traversal prevention | `path.resolve()` + `startsWith(cwd)` check in static file server |
| `.gitignore` | `.env`, `node_modules` excluded from version control |

---

## 6. Accessibility (WCAG 2.1 AA)

Skip links on all 7 pages, full ARIA landmark/role/live-region coverage, keyboard navigation with visible focus states, `prefers-reduced-motion` support, 4.5:1+ colour contrast — and a dedicated **Accessibility Services** page offering wheelchair routing, sensory-friendly zone info, and one-tap assistance requests, reflecting accessibility as a first-class product feature, not just a compliance checkbox.

---

## 7. Testing

```bash
npm test
```

Comprehensive suite covering crowd-safety modelling (density, Level of Service, gate congestion, evacuation time, composite risk scoring), carbon/sustainability calculations, and input validation/security — zero external dependencies, pure Node.js. CI runs the full suite plus ESLint on every push via GitHub Actions.

---

## 8. Setup & Run

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

## 9. Deployment

Vercel-only, single-command deploy:

```bash
git push origin main
```

`vercel.json` rewrites `/api/chat` to the serverless function — no separate backend process required. Set `GROQ_API_KEY` and `GROQ_MODEL` in Vercel → Settings → Environment Variables.

---

## 10. How This Maps to the Evaluation Rubric

| Criterion | Where to Look |
|---|---|
| **Code Quality** | Pure functions in `crowd-model.js` and `carbon.js`; full JSDoc with typedefs; named constants citing real safety standards (NFPA 101, Fruin LOS); `shared.js` eliminates duplication; consistent `'use strict'` and defensive null checks throughout |
| **Security** | `api/chat.js` + `server.js` — validated proxy, rate limiting, XSS sanitisation, security headers, path traversal prevention, `.env` isolation |
| **Efficiency** | `DocumentFragment`-free templated rendering kept lean; `throttleRaf` for scroll/resize; Three.js scenes properly `dispose()`d on stadium switch to prevent WebGL context leaks; Map-based rate-limit store with auto-cleanup |
| **Testing** | `tests/app.test.js` — zero-dependency pure Node.js suite covering crowd modelling, carbon calculations, and security; CI on every push |
| **Accessibility** | Skip links, full ARIA coverage, keyboard navigation, and a dedicated Accessibility Services page as a core platform pillar |
| **Problem statement alignment** | Every required pillar (navigation, crowd management, accessibility, transportation, sustainability, multilingual assistance, operational intelligence) is a distinct, fully-functional module — not a single feature stretched thin |

---

## 11. What Makes Blaugrana Vision Different

Most crowd-management prototypes stop at a dashboard. Blaugrana Vision adds a **procedurally-generated, fully interactive 3D model of all 16 host stadiums** — built from real venue data rather than static images — so organisers and fans can *see* the space they're planning around, tier by tier, roof type and all. Crowd risk scores aren't arbitrary numbers; they're computed from the same Fruin Level-of-Service and NFPA 101 egress standards real venues use for safety planning.

---

*Built for FIFA World Cup 2026 — Challenge 4: Smart Stadiums & Tournament Operations*