# JS Module Map

| Module | Responsibility |
|---|---|
| `shared.js` | Sanitization, formatting, debounce/throttle, chat toggle — imported by every page |
| `stadiums-data.js` | Verified FIFA venue data — single source of truth for all 16 stadiums |
| `stadium-3d.js` | Procedural Three.js stadium rendering engine |
| `crowd-model.js` | Pure crowd-safety calculations (Fruin LOS, NFPA 101) — zero DOM dependency, fully unit tested |
| `carbon.js` | Pure fan-travel emissions & sustainability scoring — zero DOM dependency, fully unit tested |
| `chatbot.js` | Groq AI chat — rate-limited, sanitized, shared across all pages |
| `errors.js` | Centralized error logging — consistent `[Module] action failed: msg` format |
| `firebase.js` / `auth.js` | Firebase config and Google Auth wrapper |
| `{page}.js` | One controller per page — DOM rendering + event wiring only, no business logic |

**Design rule:** `crowd-model.js` and `carbon.js` contain zero DOM or fetch
calls — they are pure functions, which is what makes them testable without
a browser or mocking framework.
