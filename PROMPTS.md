# Autonomous AI Creator - Development Prompts

This document records the actual prompts used during the AI-assisted vibe coding of the Autonomous AI Creator project.

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


## Phase 5: Live Web Discovery

```text
Start Phase 5: Live Web Discovery.

Make the autonomous agent capable of discovering real, current AI and technology topics from live information sources.

Goal:
Worker -> Load agent -> Discover live topics -> Normalize topics -> Deduplicate topics -> Persist discovered topics -> Finish run.

Requirements:
1. Public RSS/Atom feeds (OpenAI News, Google DeepMind Blog, AWS Machine Learning Blog, TechCrunch AI).
2. Pure dependency-free HTTP fetching and XML regex parsing.
3. URL normalization (stripping tracking query params like utm_*), title HTML stripping, and SHA-256 fingerprinting.
4. Local run deduplication and Postgres DB deduplication via (agent_id, fingerprint) unique constraint.
5. Isolated error handling per source so one failing feed does not interrupt discovery from other feeds.
6. Worker integration in runAgentCycle() updating run stage to 'discovery'.
7. Comprehensive tests in tests/discovery.test.ts covering parsing, normalization, deduplication, error handling, DB persistence, and worker integration.
```

## Phase 6: AI Editorial Decision Engine

```text
Phase 6 Goal:

Connect the live discovered topics from Phase 5 to the existing AiService and make the autonomous agent demonstrate genuine editorial judgment.

The flow should become:
Worker -> Live Discovery -> Discovered Topics -> Persona Evaluation -> Accept/Reject -> Persist Editorial Decision

Requirements:
1. Retrieve pending topics (status = 'discovered') for the current agent via getPendingDiscoveredTopics().
2. Evaluate each topic against the agent's persona using AiService.evaluateCandidateTopic().
3. Demonstrate deliberate rejections for low-signal or off-topic items.
4. Persist editorial decisions (decision, score, reason) into editorial_decisions table.
5. Atomically update discovered_topics status to 'selected' or 'rejected'.
6. Maintain idempotency so already-evaluated topics are not re-evaluated.
7. Integrate into worker loop returning stage 'editorial'.
8. Tests covering acceptance, rejection, DB persistence, idempotency, multi-topic cycles, and error handling.
```

## Phase 7: Content Generation and Autonomous Publishing

```text
PHASE 7 — CONTENT GENERATION AND AUTONOMOUS PUBLISHING

Goal: Turn an editorially selected topic into an actual autonomous post and expose it through the required feed API.

Pipeline: Live Discovery -> Editorial Evaluation -> Selected Topic -> Post Generation -> Post + Sources persisted -> GET /api/agent/feed

Requirements:
1. Select candidate topics for publishing (status = 'selected') for current agent via getSelectedTopicsForPublishing().
2. Generate source-grounded post text and rationale via AiService.draftPostForTopic().
3. Persist post, sources, and status update ('published') atomically via savePublishedPost().
4. Expose generated posts via GET /api/agent/feed?agentId=... sorted newest first.
5. Idempotent execution preventing duplicate post generation on repeated runs.
6. Worker integration in runAgentCycle() updating run stage to 'published'.
7. Test suite covering post drafting, atomic persistence, feed API contract, idempotency, and full worker cycle.
```

## Phase 8: Persistent Agent Memory & Sync Outbox

```text
PHASE 8 — PERSISTENT AGENT MEMORY AND SYNC OUTBOX

Goal: Build a durable memory/outbox layer so the autonomous agent remembers published content and synchronizes with external memory systems.

Requirements:
1. Persistent published memory in agent_memories table.
2. Memory retrieval (getRecentAgentMemories) for memory-aware editorial evaluation ("Different source does not automatically mean different idea").
3. Persistent memory_outbox table tracking sync payload, status (pending, processing, synced, failed), attempts, and last_error.
4. MemoryProvider abstraction with MockMemoryProvider (default) and BreethMemoryProvider boundary.
5. Outbox synchronization in worker cycle (syncAgentOutbox) with fault isolation (sync failure does not fail post creation or revert posts).
6. Comprehensive test suite in tests/memory.test.ts covering memory creation, outbox sync, fault tolerance, memory-aware editorial rejection, and worker cycle integration.
```

## Phase 10: Real Gemini LLM Integration & Validation

```text
PHASE 10 — REAL GEMINI LLM INTEGRATION AND VALIDATION

Goal: Connect the system to Google Gemini (gemini-2.5-flash) and perform real-world test with real generated content.

Requirements:
1. Gemini LLM Provider in src/ai/providers/gemini.ts implementing LlmProvider interface.
2. Provider factory registration supporting AI_PROVIDER=gemini, GEMINI_API_KEY=, and GEMINI_MODEL=gemini-2.5-flash.
3. Offline error validation test suite in tests/gemini_validation.test.ts verifying missing key handling and database safety.
4. End-to-end real API validation with persona "AI Security Intelligence Creator".
5. Real-world quality audit inspecting live discovered sources, Gemini editorial decisions, source grounding, and feed API outputs.
```

