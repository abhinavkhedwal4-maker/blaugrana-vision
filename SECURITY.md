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
- **Prompt injection prevention**: `sanitizePromptInjection()` detects and
  neutralizes 12 common injection patterns (`ignore instructions`, `system:`,
  `you are now`, `[INST]`, `jailbreak`, `developer mode`, `pretend you are`,
  `forget instructions`, `override system`, etc.) at the client boundary
  (`js/shared.js`) AND the server boundary (`api/chat.js`, `server.js`) —
  defense in depth.
- **Input validation**: every chat message is validated (`validateMessages`)
  and sanitized (`sanitizeString`) before reaching the AI or being rendered.
- **2-tier rate limiting**: 100 req/min (general), 20 req/min (AI endpoint)
  per IP server-side; 10 msg/min client-side. AI calls are expensive — the
  tighter AI limit prevents cost abuse while allowing normal page browsing.
- **HTTP hardening**: CSP, HSTS, X-Content-Type-Options, X-Frame-Options,
  Referrer-Policy, Permissions-Policy, Cross-Origin-Opener-Policy,
  Cross-Origin-Resource-Policy, X-Permitted-Cross-Domain-Policies on every
  response.
- **Rate-limit transparency**: `X-RateLimit-Limit` and `Retry-After` headers
  returned on API responses so clients can back off gracefully.
- **XSS-safe markdown rendering**: bold/italic content inside AI responses is
  sanitized via `sanitizeString()` before being wrapped in `<strong>`/`<em>`.
- **Content-type CSRF gate**: non-`application/json` POSTs to `/api/chat`
  are rejected (blocks cross-site form submissions).
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

## OWASP Top 10 (2021) Mapping

| Risk | Status | Our Mitigation |
|---|---|---|
| A01: Broken Access Control | ✅ Mitigated | Firestore Security Rules require auth for all writes; reads are intentionally public |
| A02: Cryptographic Failures | ✅ Mitigated | HTTPS/HSTS enforced; no sensitive data stored client-side; API key never leaves the serverless function |
| A03: Injection | ✅ Mitigated | Prompt injection filter at every AI boundary + HTML escaping via `sanitizeString` + `validateMessages` schema validation |
| A04: Insecure Design | ✅ Mitigated | Threat model documented above; deterministic crowd-safety logic kept out of the LLM; safety classification is testable independent of AI behaviour |
| A05: Security Misconfiguration | ✅ Mitigated | Full security header set (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy); `npm audit` in CI |
| A06: Vulnerable Components | ✅ Mitigated | Zero runtime dependencies beyond `dotenv`; only `eslint` in devDependencies; `npm audit --audit-level=high` runs on every CI push |
| A07: Authentication Failures | ✅ Mitigated | Firebase Auth for write-gated operations; 2-tier rate limiting on all endpoints; client + server-side message limits |
| A08: Software and Data Integrity | ✅ Mitigated | CI runs lint + tests on every push before merge; PR template enforces test gate; `CODEOWNERS` protects security-sensitive files |
| A09: Security Logging and Monitoring Failures | ✅ Mitigated | Structured `console.error` with module tags on every failure path; `[Groq Error]`, `[Validation Error]`, `[Operations]` prefixes enable log filtering |
| A10: Server-Side Request Forgery | N/A | No server-side requests to user-supplied URLs anywhere in the application |

## Incident Response

1. **Identify** — confirm the security event via CI alerts, rate-limit logs, or Vercel function logs
2. **Contain** — rotate the Groq API key immediately in Vercel → Settings → Environment Variables
3. **Eradicate** — patch the vulnerable code path; add a regression test to `tests/app.test.js`
4. **Recover** — push the patched branch; Vercel auto-deploys on merge to `main`
5. **Review** — document the root cause and fix in `CHANGELOG.md` under a new version entry

## Reporting a Vulnerability

Open a GitHub issue titled `[security]` (no exploit details in the issue
itself), or contact the maintainer directly via `/.well-known/security.txt`.
Response within 48 hours.
