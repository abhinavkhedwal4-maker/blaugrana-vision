# Architecture Decision Records

## ADR-1: Deterministic logic stays out of the LLM
Crowd risk classification (normal/watch/alert/critical) is computed from
published safety standards (Fruin LOS, NFPA 101) in pure, unit-tested
functions. The AI only converts an already-computed score into prioritized
recommendations — it never classifies risk itself. This keeps
safety-relevant logic testable and repeatable regardless of model behaviour.

## ADR-2: Vanilla JS over a framework
Chosen to eliminate build tooling entirely — the app deploys as static
files plus one serverless function, with zero build step and instant
local startup. Trade-off: less type safety than a TypeScript stack, offset
by strict JSDoc typing and a zero-dependency test suite covering all pure
logic.

## ADR-3: Groq over other LLM providers
Selected for inference speed — critical for a fan asking for directions
while standing in a crowded concourse.

## ADR-4: One shared chat component across seven pages
`chatbot.js` and `shared.js` are imported by every page rather than
duplicated per-page, so validation, sanitization and rate-limiting logic
exists in exactly one place.
