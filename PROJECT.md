# Autonomous AI Creator - project plan

## Objective

Build one autonomous AI and technology creator. The evaluator will call `POST /api/agent/init` exactly once and then observe only `GET /api/agent/feed?agentId=...` for about 48 hours. The system must continue researching, evaluating, remembering, and publishing without further evaluator action.

## Current foundation

The repository now contains:

- Next.js, TypeScript, and Tailwind CSS application shell.
- PostgreSQL-compatible schema and a small `pg` data-access layer.
- API route scaffolding for agent initialization and feed reads.
- A separate TypeScript worker entry point.
- Environment-variable, migration, and local PostgreSQL Compose setup.

The worker is intentionally inert at this stage. No live-topic discovery, LLM calls, Breeth calls, or post generation have been implemented yet.

## Required behavior

- Discover current AI and technology topics from live, trusted sources.
- Evaluate candidates against a consistent creator persona and intentionally record rejections.
- Avoid repeat topics and preserve all previously published posts.
- Publish selectively over time, including a rationale and the supporting sources for every post.
- Return immutable feed history newest-first, with unique IDs and ISO 8601 UTC timestamps.
- Return `{ "posts": [] }` when a valid agent has no posts.

## Planned architecture

```text
Next.js API routes                 PostgreSQL                 worker process
POST /api/agent/init  ----------> agents, jobs  <----------- claims due jobs
GET /api/agent/feed   <---------- posts, sources ----------- discovers, judges,
                                                            drafts, persists
                                                                  |
                                                                  v
                                                         Breeth (optional
                                                         editorial memory)
```

- **Web application:** Next.js route handlers. Feed requests only read persisted posts; they never trigger agent work.
- **Database:** PostgreSQL is the canonical source of truth for agents, scheduled jobs, posts, source evidence, and editorial decisions.
- **Worker:** a separately deployed, always-on TypeScript process that claims due jobs. It must persist its schedule and recover work after restarts.
- **AI:** used for bounded editorial judgment and source-grounded writing, always behind deterministic validation and cadence rules.
- **Breeth:** used as non-blocking long-term editorial memory. It should recall past angles before drafting and receive compact post/decision summaries after durable database writes. A Breeth outage must not stop the feed.

## Delivery milestones

1. **Foundation complete:** application, database schema, API contract, and worker boundary.
2. **Durable job runner:** claim jobs safely, persist retry state, and prove the worker operates without feed polling.
3. **Live discovery:** fetch a small allowlist of reputable AI and technology feeds; normalize and deduplicate source items.
4. **Editorial workflow:** use AI to score and reject candidates, retain rejection reasons, and draft source-backed posts in the fixed persona.
5. **Publishing safeguards:** enforce freshness, source validation, cadence, content similarity checks, unique IDs, and UTC output.
6. **Memory integration:** add Breeth retrieval and outbox-based writes without making it the system of record.
7. **Operational verification:** restart the worker during tests, verify it resumes due jobs, and confirm posts remain available across the observation window.

## Explicit non-goals

- Real social-media publishing or account integrations.
- Dashboard, authentication, engagement analytics, comments, follows, or notifications.
- Multiple agents, persona editors, a vector database, microservices, or a complex agent framework.
- Broad or brittle browser scraping.

## Evaluator risks to guard against

- A job loop tied to an HTTP request or serverless instance will stop when evaluator traffic stops.
- An interval that only runs after the first delay may produce no early evidence of activity.
- Publishing every item, losing old posts, duplicate IDs, local timestamps, unsupported claims, or missing sources will fail the required behavior.
- In-memory job/feed state will be lost on restart.

The worker therefore needs an immediate first job, persistent scheduling, append-only posts, atomic writes, source-grounded generation, and explicit rejection records.
