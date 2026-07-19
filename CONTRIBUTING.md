# Contributing to Blaugrana Vision

## Setup

```bash
npm install
cp .env.example .env   # add GROQ_API_KEY
npm start              # http://localhost:3000
```

## Quality Bar (run before pushing)

| Command | What it checks |
|---|---|
| `npm run lint` | ESLint, zero warnings (`--max-warnings=0`) |
| `npm test` | Full test suite (crowd-safety, carbon, security, prompt injection, accessibility, edge cases) |

CI runs both automatically on every push via GitHub Actions.

## Code Style Enforcement

- **ESLint** runs on every push via CI (`npm run lint`) — zero warnings required to merge.
- **Prettier** config is in `.prettierrc` — semi: true, singleQuote: true, trailingComma: all, printWidth: 100.
- **No inline event handlers** (`onclick=""`, etc.) — use `data-action` attributes + `addEventListener` for new code. Existing handlers use `window.*` globals for ES module compatibility.
- **Every exported function** requires a complete JSDoc block: description, `@param` for every parameter, `@returns`.
- **One responsibility per function** — page controllers only render DOM and wire events; all calculation logic lives in `crowd-model.js` / `carbon.js`. Pattern: `fetchX()` → `renderX(data)` → `wireX()`.

## Project Structure

Feature-per-page architecture: each page has one matching JS controller
and CSS file. Shared logic (sanitization, prompt-injection filtering, chat, dropdowns) lives in
`js/shared.js`. Pure calculation logic (`crowd-model.js`, `carbon.js`) is
kept dependency-free and fully unit tested.

## Commit Conventions

Conventional Commits, imperative mood: `feat(navigator): add language
passthrough`, `fix(operations): guard empty incident payload`, `security(shared): add prompt injection filter`.

## Accessibility Verification

Before every release, run the **axe DevTools** browser extension against all
8 pages and confirm 0 violations. This is the same axe-core engine used by
automated testing-library suites — run manually here since the project has
no client-side test runner by design (zero build step, zero dependencies).

Checklist per page:

- [ ] 0 critical/serious axe violations
- [ ] Tab order follows visual layout
- [ ] All interactive elements reachable by keyboard
- [ ] Screen reader announces dynamic content (chat messages, AI briefings, risk level badge)
- [ ] `aria-current="page"` present on the active nav link
- [ ] AI chat responses carry correct `lang` and `dir` attributes in non-English language mode
