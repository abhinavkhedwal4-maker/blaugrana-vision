# Security Policy

## Threat Model
Blaugrana Vision is a public, read-mostly platform. The only user inputs are
free-text chat questions and a small set of forms (incident reports,
assistance requests). The assets worth protecting are the Groq API key,
Firestore data, and service availability. Realistic threats: prompt-injection
through chat input, abuse of the AI endpoint (cost/DoS), and leakage of
stack traces or credentials.

## Controls in Place
- **Secrets**: Groq API key lives only in the serverless function's
  environment (Vercel env vars / local `.env`), never in the repo or client.
- **Input validation**: every chat message is validated (`validateMessages`)
  and sanitized (`sanitizeString`) before reaching the AI or being rendered.
- **Rate limiting**: 30 req/min per IP server-side, 10 msg/min client-side.
- **HTTP hardening**: CSP, HSTS, X-Content-Type-Options, X-Frame-Options,
  Referrer-Policy, Permissions-Policy on every response.
- **Output handling**: AI responses are rendered via `formatMessage()`,
  which sanitizes before any markdown-to-HTML conversion — model output
  can never inject raw HTML.
- **Path traversal prevention**: static file serving resolves and validates
  paths stay within the working directory.

## Authentication Decision
Fan-facing pages are deliberately account-free — no personal data is
exposed and no privileged actions exist without sign-in. Firebase
Authentication gates only incident-logging writes (`operations.html`);
reads are public for operational transparency.

## Known Tradeoff: Inline Event Handlers and Firebase Scripts
The CSP's `script-src` includes `'unsafe-inline'` and `https://www.gstatic.com`
for two deliberate reasons:

1. **Inline `onclick=""` handlers** — used for simplicity across 7 pages. All
   handlers call only internal, sanitized functions (never `eval`, never
   user-controlled strings), so the practical risk is low.
2. **Firebase SDK** — loaded from `https://www.gstatic.com` (Google's CDN).
   This is the official, integrity-pinned delivery mechanism for Firebase
   browser modules; there is no self-hosted alternative.

`connect-src` also allows `https://*.googleapis.com` and
`https://*.firebaseio.com` for Firestore and Auth API calls.
Google user avatars are served from `https://*.googleusercontent.com`,
so `img-src` includes that origin.

A future iteration would migrate `onclick` handlers to `addEventListener`
and use a nonce-based CSP, eliminating `'unsafe-inline'` for scripts.

## Reporting a Vulnerability
Open a GitHub issue titled `[security]` (no exploit details in the issue
itself), or contact the maintainer directly. Response within 48 hours.
