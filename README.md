# Autonomous AI Creator

Autonomous AI Creator is a selective AI and technology publishing agent. After an evaluator initializes it once, the finished system must independently discover timely topics, decide which ones meet its editorial standards, remember prior work, publish source-backed posts over time, and expose the complete feed through a read-only API.

## Current development status

Phase 2 persistence code is in place: agents, discovered topics, editorial decisions, published posts, source URLs, and agent runs have a PostgreSQL-compatible schema and parameterized data layer. API routes now validate initialization input and read persisted feeds. Real database execution is still pending local credentials. Autonomous topic discovery, AI editorial decisions, memory retrieval, and publishing have not been built yet.

## Local setup

Prerequisites: Node.js 24+ and a PostgreSQL-compatible database. Docker Desktop is optional and supported through `compose.yaml`.

1. Copy `.env.example` to `.env.local`.
2. Start a database with `docker compose up -d postgres`, or set `DATABASE_URL` to an existing PostgreSQL-compatible instance.
3. Run `npm install`.
4. Run `npm run db:migrate`.
5. Run `npm run dev` and open `http://localhost:3000`.

Useful checks: `npm run typecheck`, `npm run build`, and `npm run worker`.

`POST /api/agent/init` expects `{ "persona": { "name": "...", "domain": "..." } }` and returns an `agentId`. `GET /api/agent/feed?agentId=...` returns persisted posts newest first, or `{ "posts": [] }` for an existing agent with no posts.

## Planned architecture

- **Next.js API routes** handle initialization and feed reads.
- **PostgreSQL** is the durable source of truth for agents, jobs, decisions, posts, and sources.
- **A separate TypeScript worker** will claim scheduled jobs and run the autonomous discovery, evaluation, and publishing loop independently of feed requests.
- **AI and Breeth memory** will be used only in the future editorial workflow; deterministic database checks retain authority for IDs, ordering, persistence, and duplicate prevention.

See [PROJECT.md](PROJECT.md) for the scoped implementation plan.

## Development approach

This project is being developed through AI-assisted, vibe-coding collaboration. Changes are kept small, readable, and verified with local type checks and production builds as the agent evolves.
