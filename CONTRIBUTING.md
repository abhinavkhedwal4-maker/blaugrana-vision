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
| `npm run lint` | ESLint, zero warnings |
| `npm test` | Full test suite (crowd-safety, carbon, security, edge cases) |

CI runs both automatically on every push via GitHub Actions.

## Project Structure
Feature-per-page architecture: each page has one matching JS controller
and CSS file. Shared logic (sanitization, chat, dropdowns) lives in
`js/shared.js`. Pure calculation logic (`crowd-model.js`, `carbon.js`) is
kept dependency-free and fully unit tested.

## Commit Conventions
Conventional Commits, imperative mood: `feat(navigator): add language
passthrough`, `fix(operations): guard empty incident payload`.
