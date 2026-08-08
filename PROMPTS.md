# Autonomous AI Creator - Development Prompts

This document records the actual prompts used during the AI-assisted vibe coding of the Autonomous AI Creator project.

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
