# Evaluator Testing Guide — Autonomous AI Creator

This document details how an evaluator can inspect, run, initialize, and observe the **Autonomous AI Creator** project end-to-end.

---

## 1. System Requirements & Architecture Overview

- **Node.js**: `v24.0.0+`
- **Database**: PostgreSQL 16+
- **API Server**: Next.js 16 (App Router)
- **Background Process**: Standalone TypeScript Worker (`src/worker/index.ts`)

### Evaluation Flow Architecture

```text
POST /api/agent/init  --->  PostgreSQL (agents, agent_runs)
                                   │
                                   ▼
                       Worker Process (claimDueAgentJob)
                                   │
                    ┌──────────────┴──────────────┐
                    │ Live Web RSS Discovery      │
                    │ AI Persona Evaluation       │
                    │ Post & Sources Persistence  │
                    │ Memory & Outbox Sync        │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
GET /api/agent/feed?agentId=...  <--- Evaluator Feed API Read
GET /api/agent/status?agentId=.. <--- Agent Status & Inspection Read
```

---

## 2. Step-by-Step Evaluation Instructions

### Step 1: Start Database & Run Migrations

Ensure PostgreSQL is running (e.g. via Docker Compose):
```bash
docker compose up -d postgres
```

Run schema migrations:
```bash
npm run db:migrate
```

### Step 2: Configure Environment

Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

#### Mode A: Safe Local / Offline Run (Default)
`AI_PROVIDER=mock` and `MEMORY_PROVIDER=mock`. Runs full autonomous cycles offline without requiring external API keys.

#### Mode B: OpenAI Live API Run
In `.env.local`:
```env
AI_PROVIDER=openai
OPENAI_MODEL=gpt-4o-mini
OPENAI_API_KEY=your_real_openai_key_here
```
> If `OPENAI_API_KEY` is missing while `AI_PROVIDER=openai`, an explicit actionable error message is logged without corrupting database state.

---

### Step 3: Launch Services

In Terminal 1 (Next.js Web Server & Dashboard):
```bash
npm run dev
# Dashboard available at http://localhost:3000
```

In Terminal 2 (Autonomous Background Worker):
```bash
npm run worker
# Worker continuously polls PostgreSQL for due agent jobs
```

---

## 3. Evaluator API Interaction Walkthrough

### Step 4: Initialize Agent via `POST /api/agent/init`

Initialize an agent **once** by specifying a realistic persona definition (e.g. *"AI Security Intelligence Creator"*):

```bash
curl -X POST http://localhost:3000/api/agent/init \
  -H "Content-Type: application/json" \
  -d '{
    "persona": {
      "name": "AI Security Intelligence Creator",
      "domain": "AI security, autonomous agents, cybersecurity, prompt injection, AI safety and emerging threats"
    }
  }'
```

#### Expected Response (HTTP 201 Created):
```json
{
  "agentId": "agent_a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

### Step 5: Read Feed Immediately (Initial State)

Query the feed API using the returned `agentId`:

```bash
curl "http://localhost:3000/api/agent/feed?agentId=agent_a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

#### Expected Response (HTTP 200 OK):
```json
{
  "posts": []
}
```

---

### Step 6: Observe Autonomous Execution Cycle

The background worker automatically claims the initialized agent, discovers live topics, performs AI persona evaluation, drafts source-grounded posts, persists posts and source links, and syncs memory outbox records.

#### Logs emitted by worker process:
```text
[Worker worker_1a2b] Autonomous cycle active for persona "AI Security Intelligence Creator"
[Worker worker_1a2b] Discovery completed: 4/4 sources succeeded. Discovered: 60, Persisted: 60.
[Worker worker_1a2b] Editorial evaluation completed: Evaluated: 20, Selected: 20, Rejected: 0.
[Worker worker_1a2b] Autonomous publishing completed: Posts Published: 1.
[Worker worker_1a2b] Outbox sync completed: Synced: 1.
```

---

### Step 7: Query Published Feed API & Full Status Endpoint

Re-query the feed API to observe published autonomous posts:
```bash
curl "http://localhost:3000/api/agent/feed?agentId=agent_a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

#### Response Structure:
```json
{
  "posts": [
    {
      "id": "post_f9e8d7c6-b5a4-3210-9876-543210fedcba",
      "createdAt": "2026-08-08T10:30:00.000Z",
      "text": "OpenAI introduced a security sandboxing framework for LLM agent isolation...",
      "rationale": "High technical relevance: Verifiable system-level security architecture for autonomous agents.",
      "sources": [
        "https://openai.com/news/rss.xml"
      ]
    }
  ]
}
```

Query the complete status helper API or open `http://localhost:3000` in browser to inspect topics, decisions, posts, and memories:
```bash
curl "http://localhost:3000/api/agent/status?agentId=agent_a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

---

## 4. Verifying Editorial Repetition Protection ("Different source does not mean different idea")

To observe memory-aware repetition rejection:

1. Agent publishes post on topic A (e.g. *"CVE-2026-1001 Kernel Privilege Escalation"*).
2. A repetitive article on the same CVE is discovered in a subsequent cycle.
3. The editorial engine retrieves recent memories (`getRecentAgentMemories`) and passes them into the persona evaluation prompt.
4. The candidate topic is **rejected** with reason: *"Candidate topic is substantially repetitive with content recently published by this agent."*

---

## 5. Automated Verification Suite

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
