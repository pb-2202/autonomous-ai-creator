# Chronological Development Prompt Log — Autonomous AI Creator

This document records the chronological prompts used during the development of the **Autonomous AI Creator** project across all 9 phases.

---

## Phase 1: Next.js Foundation and Required API Endpoints

```text
PHASE 1 — NEXT.JS FOUNDATION & API CONTRACT

Goal: Initialize Next.js app structure, TypeScript definitions, database schema outline, and required API routes.

Requirements:
- POST /api/agent/init accepting persona definition and returning agentId.
- GET /api/agent/feed?agentId=... returning posts array ordered newest first.
```

---

## Phase 2: PostgreSQL Persistence Layer

```text
PHASE 2 — POSTGRESQL PERSISTENCE LAYER

Goal: Build parameterized database persistence for agents, discovered topics, editorial decisions, posts, sources, and agent runs.

Requirements:
- PostgreSQL connection pool (pg).
- Schema migrations for agents, discovered_topics, editorial_decisions, posts, post_sources, agent_runs.
- Parameterized query functions with transaction support.
```

---

## Phase 3: Autonomous Worker Execution Engine

```text
PHASE 3 — AUTONOMOUS WORKER EXECUTION FOUNDATION

Goal: Build an independent TypeScript worker process claiming due agent jobs with PostgreSQL locking and exponential backoff retry handling.

Requirements:
- Atomic job claiming via FOR UPDATE SKIP LOCKED.
- Stale lock recovery.
- Resilient polling loop.
```

---

## Phase 4: AI Intelligence & Persona Engine

```text
PHASE 4 — AI INTELLIGENCE FOUNDATION

Goal: Build persona definition builder, LlmProvider abstraction (MockLlmProvider & OpenAiLlmProvider), JSON block schema validators, and AiService.
```

---

## Phase 5: Live Web Topic Discovery

```text
PHASE 5 — LIVE WEB DISCOVERY

Goal: Enable autonomous discovery of current AI & tech topics from public RSS/Atom feeds with URL normalizer, SHA-256 topic fingerprinter, and feed source error isolation.
```

---

## Phase 6: AI Editorial Decision Engine

```text
PHASE 6 — AI EDITORIAL DECISION ENGINE

Goal: Evaluate discovered candidate topics against persona policy via AiService. Persist decisions (selected/rejected, score, reason) in editorial_decisions table.
```

---

## Phase 7: Content Generation and Autonomous Publishing

```text
PHASE 7 — CONTENT GENERATION AND AUTONOMOUS PUBLISHING

Goal: Turn editorially selected topics into source-grounded post text and rationale. Persist post + sources atomically and serve via GET /api/agent/feed.
```

---

## Phase 8: Persistent Agent Memory & Sync Outbox

```text
PHASE 8 — PERSISTENT AGENT MEMORY AND SYNC OUTBOX

Goal: Build durable agent memory table (agent_memories), memory retrieval for repetition protection ("Different source does not mean different idea"), transactional outbox (memory_outbox), and extensible MemoryProvider abstraction (Mock / Breeth boundary).
```

---

## Phase 9: Deployment Hardening & Evaluator Simulation

```text
PHASE 9 — DEPLOYMENT HARDENING AND EVALUATOR SIMULATION

Goal: Make system deployable and test it as an external evaluator would.

Requirements:
1. Environment configuration audit in .env.example (Required vs Optional vs Tuning).
2. Multi-stage Dockerfile and Docker Compose setup for web and background worker services.
3. Accelerated 48-hour evaluator simulation test in tests/evaluator_simulation.test.ts.
4. Step-by-step evaluator testing guide in EVALUATION.md.
5. Interactive preview dashboard in src/app/page.tsx for initializing agents and viewing live feeds.
6. Documentation updates in README.md, DEVELOPMENT_STATUS.md, and PROMPTS.md/prompt.md.
7. Verification across npm run db:migrate, npm run typecheck, npm test, npm run build, and worker single-run mode.
```
