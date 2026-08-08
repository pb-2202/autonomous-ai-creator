# Autonomous AI Creator

**Autonomous AI Creator** is a selective AI and technology publishing agent built for the ABTalks Vibe Code Hackathon.

After an evaluator initializes an agent **once** via `POST /api/agent/init`, the system runs completely autonomously: it discovers timely AI & tech developments from live web RSS/Atom feeds, evaluates candidate topics against persona editorial standards, rejects repetitive or low-signal announcements, drafts source-grounded posts with explicit rationale, records durable memories, and exposes an immutable JSON feed via `GET /api/agent/feed?agentId=...`.

---

## Key Features & Editorial Philosophy

1. **Autonomous Operation**: Runs continuously via a background worker process (`src/worker/index.ts`) using PostgreSQL job claiming (`FOR UPDATE SKIP LOCKED`). No human interaction is required after initialization.
2. **Selective Editorial Stance**: Implements two core editorial beliefs:
   - *"New does not automatically mean important."* (Filters hype, speculative rumors, and trivial announcements).
   - *"Different source does not automatically mean different idea."* (Uses Phase 8 memory retrieval to reject repetitive topics across cycles).
3. **Source Grounding**: Every published post links directly to its origin URL and provides explicit editorial rationale.
4. **Fault Tolerant Outbox Sync**: Includes a transactional outbox (`memory_outbox`) for long-term memory sync (`MockMemoryProvider` default; `BreethMemoryProvider` boundary). Breeth integration is optional—if unconfigured, posts remain safely published and retries are logged.

---

## Evaluator Quick Start

### 1. Prerequisites
- **Node.js**: `v24.0.0+`
- **PostgreSQL**: `16+` (or Docker Desktop)

### 2. Environment & Database Setup
```bash
# 1. Clone repository & install dependencies
npm install

# 2. Configure environment (Gemini, OpenAI, or safe Mock default)
cp .env.example .env.local

# For Real Gemini LLM integration (gemini-2.5-flash):
# Set AI_PROVIDER=gemini and GEMINI_API_KEY=your_key in .env.local

# 3. Start PostgreSQL container
docker compose up -d postgres

# 4. Run idempotent database migrations
npm run db:migrate
```

### 3. Launch Services
- **Terminal 1** (Web Server):
  ```bash
  npm run dev
  ```
- **Terminal 2** (Autonomous Background Worker):
  ```bash
  npm run worker
  ```

---

## API Contract

### Initialize Creator Agent
```bash
POST /api/agent/init
Content-Type: application/json

{
  "persona": {
    "name": "AI Security Analyst",
    "domain": "AI Security & Systems Engineering"
  }
}
```

#### Response (HTTP 201):
```json
{
  "agentId": "agent_a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

### Read Published Feed
```bash
GET /api/agent/feed?agentId=agent_a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

#### Response (HTTP 200 OK):
```json
{
  "posts": [
    {
      "id": "post_12345678-abcd-ef01-2345-6789abcdef01",
      "createdAt": "2026-08-08T10:30:00.000Z",
      "text": "OpenAI published research on secure sandboxing for LLM agents...",
      "rationale": "High technical relevance: Verifiable system-level security architecture for autonomous agents.",
      "sources": [
        "https://openai.com/news/rss.xml"
      ]
    }
  ]
}
```

---

## Automated Verification & Testing

Run full automated typecheck, test suite, and production build:
```bash
npm run typecheck
npm test
npm run build
```

Single-pass worker verification:
```bash
WORKER_SINGLE_RUN=true npm run worker
```

For step-by-step evaluator instructions, see [EVALUATION.md](EVALUATION.md).
For development prompt history, see [PROMPTS.md](PROMPTS.md) and [prompt.md](prompt.md).
