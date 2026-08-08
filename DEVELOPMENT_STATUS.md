# Development status

## Completed

- **Phase 1 Foundation**: Next.js, TypeScript, Tailwind CSS, PostgreSQL connection pooling, database schema, migration utility, and API route scaffolding.
- **Phase 2 Persistence**: Parameterized `pg` repositories for agents, topics, editorial decisions, posts, sources, and agent runs.
- **Phase 3 Autonomous Execution Foundation**:
  - PostgreSQL execution state: `next_run_at`, `processing_status` (`idle`/`running`), `locked_at`, `locked_by`, and `consecutive_failures` on `agents` with index `agents_worker_claim_index`.
  - Atomic job claiming (`claimDueAgentJob` with `FOR UPDATE SKIP LOCKED`), exponential backoff (`completeAgentRunFailure`), and lock recovery (`recoverStaleAgentLocks`).
  - Worker execution loop with configurable cadence and signal handling (`SIGINT`/`SIGTERM`).
- **Phase 4 Intelligence Foundation**:
  - Persona Engine (`src/ai/persona/builder.ts`): Rich persona definition builder expanding `{ name, domain }` into identity, mission, editorial stance ("New does not automatically mean important"), interests, and persona system prompts.
  - LLM Provider Abstraction (`src/ai/providers/`): `LlmProvider` interface supporting `generateText` and `generateStructured<T>`. Includes `MockLlmProvider` (safe default for local dev/testing) and native-fetch `OpenAiLlmProvider`.
  - Response Validation & Schemas (`src/ai/schemas/validators.ts`): Typed JSON block parsers and strict range/field validators for `EditorialEvaluationResult` and `PostGenerationResult`.
  - High-Level AI Service (`src/ai/service.ts`): `AiService` orchestrating persona policy and provider execution.
- **Phase 5 Live Web Discovery**:
  - Discovery Sources (`src/discovery/config.ts`): Configured 4 live public sources (OpenAI News, Google DeepMind Blog, AWS Machine Learning Blog, TechCrunch AI).
  - Dependency-Free HTTP Fetcher & Parser (`src/discovery/fetcher.ts`, `parser.ts`): Signal-timeout HTTP fetcher with regex XML parser supporting RSS `<item>` and Atom `<entry>` feeds.
  - Normalization & Fingerprinting (`src/discovery/normalizer.ts`): HTML tag stripping, whitespace trimming, tracking parameter stripping (`utm_*`), and SHA-256 fingerprint generation.
  - Discovery Service (`src/discovery/service.ts`): Orchestrates feed retrieval, error isolation (failing sources do not abort discovery), local & DB deduplication against `discovered_topics`, and database persistence.
  - Worker Integration (`src/worker/index.ts`): Executes `discoverTopics(agent)` during worker runs and records run status in stage `'discovery'`.
  - Test Suite (`tests/discovery.test.ts`): Comprehensive unit and integration test suite covering feed parsing, URL/text normalization, deduplication, error isolation, DB persistence, and worker integration.

## Remaining (Future Phases)

- Phase 6: AI editorial decision engine & deliberate rejection logging.
- Phase 7: Source-grounded post & rationale generation + atomic publishing.
- Phase 8: Post memory retrieval & Breeth outbox sync.
- Phase 9: Evaluator-window simulation (48h), cloud deployment, and final submission prep.

## Verified

- `npm run db:migrate` schema check passed.
- `npm run typecheck` passes cleanly with 0 TypeScript errors.
- `npm run build` generates production Next.js build.
- `npm test` passes all 30 test cases across persistence, AI, and discovery test suites.
- `npm run worker` single-run mode executes live web discovery cycle, retrieving and persisting live tech topics to PostgreSQL.



