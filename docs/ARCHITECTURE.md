# Architecture

A fan or organizer opens any page — all served statically from Vercel's
edge network. Chat questions POST to `/api/chat`, which validates and
sanitizes the payload, then proxies to Groq's LLaMA 3.3 70B with a
system-framed prompt. Crowd Operations and Sustainability pages compute
all risk scores and emissions figures locally in pure functions
(`crowd-model.js`, `carbon.js`) — the AI is only invoked to turn
already-computed state into human-readable recommendations, never to
perform the underlying safety calculation itself. This keeps
safety-relevant logic deterministic, testable and auditable independent
of the AI's behaviour. Firestore stores incident logs and tracker data;
Firebase Auth gates writes only.
