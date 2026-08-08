import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { database, withTransaction } from "../lib/db.ts";
import type { DiscoveredTopic, FeedPost } from "../lib/types.ts";
import type {
  AgentMemory,
  MemoryOutboxRecord,
  MemorySyncStatus,
  OutboxPayload
} from "./types.ts";

function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

type MemoryRow = {
  id: string;
  agent_id: string;
  post_id: string;
  topic_title: string;
  summary: string | null;
  post_text: string;
  rationale: string;
  source_urls: string[];
  fingerprint: string;
  published_at: Date;
  sync_status: string;
  created_at: Date;
};

type OutboxRow = {
  id: string;
  agent_id: string;
  memory_id: string;
  payload: OutboxPayload;
  status: string;
  attempts: number;
  last_attempt_at: Date | null;
  synced_at: Date | null;
  last_error: string | null;
  created_at: Date;
};

function toAgentMemory(row: MemoryRow): AgentMemory {
  return {
    id: row.id,
    agentId: row.agent_id,
    postId: row.post_id,
    topicTitle: row.topic_title,
    summary: row.summary,
    postText: row.post_text,
    rationale: row.rationale,
    sourceUrls: row.source_urls || [],
    fingerprint: row.fingerprint,
    publishedAt: row.published_at.toISOString(),
    syncStatus: row.sync_status as MemorySyncStatus,
    createdAt: row.created_at.toISOString()
  };
}

function toOutboxRecord(row: OutboxRow): MemoryOutboxRecord {
  return {
    id: row.id,
    agentId: row.agent_id,
    memoryId: row.memory_id,
    payload: row.payload,
    status: row.status as MemorySyncStatus,
    attempts: row.attempts,
    lastAttemptAt: row.last_attempt_at ? row.last_attempt_at.toISOString() : null,
    syncedAt: row.synced_at ? row.synced_at.toISOString() : null,
    lastError: row.last_error,
    createdAt: row.created_at.toISOString()
  };
}

export function computeMemoryFingerprint(title: string, postText: string): string {
  const normTitle = title.trim().toLowerCase();
  const normText = postText.trim().toLowerCase();
  return createHash("sha256")
    .update(`${normTitle}\n${normText}`)
    .digest("hex");
}

export async function saveAgentMemory(post: FeedPost, topic: DiscoveredTopic): Promise<AgentMemory> {
  const memoryId = createId("mem");
  const outboxId = createId("outbox");
  const fingerprint = computeMemoryFingerprint(topic.title, post.text);
  const publishedAt = new Date(post.createdAt);

  const payload: OutboxPayload = {
    memoryId,
    agentId: topic.agentId,
    postId: post.id,
    topicTitle: topic.title,
    postText: post.text,
    rationale: post.rationale,
    sourceUrls: post.sources,
    publishedAt: post.createdAt
  };

  return withTransaction(async (client: PoolClient) => {
    const memoryResult = await client.query<MemoryRow>(
      `INSERT INTO agent_memories (
         id, agent_id, post_id, topic_title, summary, post_text, rationale, source_urls, fingerprint, published_at, sync_status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (agent_id, post_id) DO UPDATE SET
         topic_title = EXCLUDED.topic_title,
         post_text = EXCLUDED.post_text,
         rationale = EXCLUDED.rationale,
         source_urls = EXCLUDED.source_urls
       RETURNING id, agent_id, post_id, topic_title, summary, post_text, rationale, source_urls, fingerprint, published_at, sync_status, created_at`,
      [
        memoryId,
        topic.agentId,
        post.id,
        topic.title,
        topic.summary ?? null,
        post.text,
        post.rationale,
        post.sources,
        fingerprint,
        publishedAt,
        "pending"
      ]
    );

    const memory = memoryResult.rows[0];

    await client.query(
      `INSERT INTO memory_outbox (
         id, agent_id, memory_id, payload, status, attempts
       ) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (agent_id, memory_id) DO NOTHING`,
      [outboxId, topic.agentId, memory.id, JSON.stringify(payload), "pending", 0]
    );

    return toAgentMemory(memory);
  });
}

export async function getRecentAgentMemories(agentId: string, limit = 10): Promise<AgentMemory[]> {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100);
  const result = await database().query<MemoryRow>(
    `SELECT id, agent_id, post_id, topic_title, summary, post_text, rationale, source_urls, fingerprint, published_at, sync_status, created_at
     FROM agent_memories
     WHERE agent_id = $1
     ORDER BY published_at DESC, id DESC
     LIMIT $2`,
    [agentId, safeLimit]
  );

  return result.rows.map(toAgentMemory);
}

export async function getPendingOutboxRecords(agentId: string, limit = 10): Promise<MemoryOutboxRecord[]> {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100);
  const result = await database().query<OutboxRow>(
    `SELECT id, agent_id, memory_id, payload, status, attempts, last_attempt_at, synced_at, last_error, created_at
     FROM memory_outbox
     WHERE agent_id = $1
       AND status IN ('pending', 'failed')
       AND attempts < 5
     ORDER BY created_at ASC
     LIMIT $2`,
    [agentId, safeLimit]
  );

  return result.rows.map(toOutboxRecord);
}

export async function updateOutboxRecord(
  outboxId: string,
  memoryId: string,
  status: MemorySyncStatus,
  errorSummary?: string
): Promise<void> {
  const isSynced = status === "synced";
  const now = new Date();

  await withTransaction(async (client: PoolClient) => {
    await client.query(
      `UPDATE memory_outbox
       SET status = $2,
           attempts = attempts + 1,
           last_attempt_at = $3,
           synced_at = CASE WHEN $4::boolean THEN $3 ELSE synced_at END,
           last_error = $5
       WHERE id = $1`,
      [outboxId, status, now, isSynced, errorSummary ?? null]
    );

    await client.query(
      `UPDATE agent_memories
       SET sync_status = $2
       WHERE id = $1`,
      [memoryId, status]
    );
  });
}
