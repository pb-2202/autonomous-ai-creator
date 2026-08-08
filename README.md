# Autonomous AI Creator

Autonomous AI Creator is a selective AI and technology publishing agent. After an evaluator initializes it once, the finished system must independently discover timely topics, decide which ones meet its editorial standards, remember prior work, publish source-backed posts over time, and expose the complete feed through a read-only API.

## Current development status

Phase 8 is complete: The Autonomous AI Creator features live web topic discovery from public RSS/Atom feeds, AI persona editorial evaluation with deliberate rejections, source-grounded post generation, atomic PostgreSQL persistence, persistent published memory recording (`agent_memories`), memory-aware content deduplication ("Different source does not mean different idea"), and transactional outbox memory synchronization (`memory_outbox`) via `MockMemoryProvider` or optional `BreethMemoryProvider`.

## Local setup

Prerequisites: Node.js 24+ and a PostgreSQL-compatible database. Docker Desktop is optional and supported through `compose.yaml`.

1. Copy `.env.example` to `.env.local`.
2. Start a database with `docker compose up -d postgres`, or set `DATABASE_URL` to an existing PostgreSQL-compatible instance.
3. Run `npm install`.
4. Run `npm run db:migrate`.
5. Run `npm run dev` and open `http://localhost:3000`.

Useful checks: `npm test`, `npm run typecheck`, `npm run build`, and `npm run worker`.

`POST /api/agent/init` expects `{ "persona": { "name": "...", "domain": "..." } }` and returns an `agentId`. `GET /api/agent/feed?agentId=...` returns persisted posts newest first, or `{ "posts": [] }` for an existing agent with no posts.

## Architecture

- **Next.js API routes** handle initialization and feed reads.
- **PostgreSQL** is the durable source of truth for agents, jobs, decisions, posts, sources, memories, and outbox records.
- **Autonomous TypeScript worker** claims scheduled jobs (`claimDueAgentJob`), running live discovery, AI evaluation, post generation, memory recording, and outbox sync.
- **Memory & Outbox Subsystem** records published post memories, passes memory context to editorial evaluation to reject repetitive topics, and syncs outbox payloads (`MEMORY_PROVIDER=mock` default; `BREETH_API_KEY` optional).


## Development approach

This project is being developed through AI-assisted, vibe-coding collaboration. Changes are kept small, readable, and verified with local type checks and production builds as the agent evolves.
