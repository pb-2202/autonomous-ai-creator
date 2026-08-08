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
