import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { database, withTransaction } from "./db.ts";
import { createId } from "./ids.ts";
import type {
  Agent,
  AgentRun,
  AgentRunStatus,
  DiscoveredTopic,
  EditorialDecision,
  FeedPost,
  Persona,
  TopicStatus
} from "./types.ts";

type AgentRow = {
  id: string;
  persona_name: string;
  persona_domain: string;
  active: boolean;
  initialized_at: Date;
  last_run_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type TopicRow = {
  id: string;
  agent_id: string;
  title: string;
  summary: string | null;
  source_url: string | null;
  source_name: string | null;
  source_published_at: Date | null;
  discovered_at: Date;
  fingerprint: string;
  status: TopicStatus;
};

type DecisionRow = {
  topic_id: string;
  decision: "rejected" | "selected";
  reason: string;
  score: number | null;
  decided_at: Date;
};

type PostRow = {
  id: string;
  text: string;
  rationale: string;
  created_at: Date;
};

type PostSourceRow = {
  post_id: string;
  url: string;
};

type AgentRunRow = {
  id: string;
  agent_id: string;
  status: AgentRunStatus;
  stage: string | null;
  selected_topic_id: string | null;
  published_post_id: string | null;
  error_summary: string | null;
  started_at: Date;
  finished_at: Date | null;
};

export type SaveDiscoveredTopicInput = {
  agentId: string;
  title: string;
  summary?: string | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  sourcePublishedAt?: Date | null;
  discoveredAt?: Date;
  fingerprint?: string;
  status?: TopicStatus;
};

export type SaveEditorialDecisionInput = {
  topicId: string;
  decision: "rejected" | "selected";
  reason: string;
  score?: number | null;
  decidedAt?: Date;
};

export type SavePublishedPostInput = {
  agentId: string;
  text: string;
  rationale: string;
  sourceUrls: string[];
  topicId?: string | null;
  createdAt?: Date;
};

export type RecordAgentRunInput = {
  agentId: string;
  status: AgentRunStatus;
  stage?: string | null;
  selectedTopicId?: string | null;
  publishedPostId?: string | null;
  errorSummary?: string | null;
  startedAt?: Date;
  finishedAt?: Date | null;
};

function requiredText(value: string, fieldName: string, maxLength = 10_000): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`${fieldName} must be between 1 and ${maxLength} characters.`);
  }
  return normalized;
}

function optionalText(value: string | null | undefined, maxLength = 10_000): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function toAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    persona: { name: row.persona_name, domain: row.persona_domain },
    active: row.active,
    initializedAt: row.initialized_at.toISOString(),
    lastRunAt: row.last_run_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function toTopic(row: TopicRow): DiscoveredTopic {
  return {
    id: row.id,
    agentId: row.agent_id,
    title: row.title,
    summary: row.summary,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    sourcePublishedAt: row.source_published_at?.toISOString() ?? null,
    discoveredAt: row.discovered_at.toISOString(),
    fingerprint: row.fingerprint,
    status: row.status
  };
}

function toDecision(row: DecisionRow): EditorialDecision {
  return {
    topicId: row.topic_id,
    decision: row.decision,
    reason: row.reason,
    score: row.score,
    decidedAt: row.decided_at.toISOString()
  };
}

function toAgentRun(row: AgentRunRow): AgentRun {
  return {
    id: row.id,
    agentId: row.agent_id,
    status: row.status,
    stage: row.stage,
    selectedTopicId: row.selected_topic_id,
    publishedPostId: row.published_post_id,
    errorSummary: row.error_summary,
    startedAt: row.started_at.toISOString(),
    finishedAt: row.finished_at?.toISOString() ?? null
  };
}

function topicFingerprint(title: string, sourceUrl: string | null): string {
  return createHash("sha256")
    .update(`${title.trim().toLowerCase()}\n${sourceUrl?.trim().toLowerCase() ?? ""}`)
    .digest("hex");
}

function normalizeSourceUrls(sourceUrls: string[]): string[] {
  const uniqueUrls = new Set<string>();

  for (const sourceUrl of sourceUrls) {
    const normalized = requiredText(sourceUrl, "Source URL", 2_000);
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Source URLs must use HTTP or HTTPS.");
    }
    uniqueUrls.add(parsed.toString());
  }

  if (uniqueUrls.size === 0) {
    throw new Error("At least one source URL is required.");
  }

  return [...uniqueUrls];
}

export async function createAgent(persona: Persona): Promise<Agent> {
  const name = requiredText(persona.name, "Persona name", 120);
  const domain = requiredText(persona.domain, "Persona domain", 160);
  const id = createId("agent");
  const result = await database().query<AgentRow>(
    `INSERT INTO agents (id, persona_name, persona_domain)
     VALUES ($1, $2, $3)
     RETURNING id, persona_name, persona_domain, active, initialized_at, last_run_at, created_at, updated_at`,
    [id, name, domain]
  );

  return toAgent(result.rows[0]);
}

export async function getAgentById(agentId: string): Promise<Agent | null> {
  const result = await database().query<AgentRow>(
    `SELECT id, persona_name, persona_domain, active, initialized_at, last_run_at, created_at, updated_at
     FROM agents
     WHERE id = $1`,
    [agentId]
  );

  return result.rows[0] ? toAgent(result.rows[0]) : null;
}

export async function updateAgentRunStatus(agentId: string, lastRunAt = new Date()): Promise<Agent | null> {
  const result = await database().query<AgentRow>(
    `UPDATE agents
     SET last_run_at = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, persona_name, persona_domain, active, initialized_at, last_run_at, created_at, updated_at`,
    [agentId, lastRunAt]
  );

  return result.rows[0] ? toAgent(result.rows[0]) : null;
}

export async function saveDiscoveredTopic(input: SaveDiscoveredTopicInput): Promise<DiscoveredTopic> {
  const title = requiredText(input.title, "Topic title", 500);
  const sourceUrl = optionalText(input.sourceUrl, 2_000);
  const fingerprint = input.fingerprint?.trim() || topicFingerprint(title, sourceUrl);
  const result = await database().query<TopicRow>(
    `INSERT INTO discovered_topics (
       id, agent_id, title, summary, source_url, source_name, source_published_at, discovered_at, fingerprint, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (agent_id, fingerprint) DO UPDATE SET
       title = EXCLUDED.title,
       summary = EXCLUDED.summary,
       source_url = EXCLUDED.source_url,
       source_name = EXCLUDED.source_name,
       source_published_at = EXCLUDED.source_published_at,
       status = EXCLUDED.status
     RETURNING id, agent_id, title, summary, source_url, source_name, source_published_at, discovered_at, fingerprint, status`,
    [
      createId("topic"),
      input.agentId,
      title,
      optionalText(input.summary),
      sourceUrl,
      optionalText(input.sourceName, 300),
      input.sourcePublishedAt ?? null,
      input.discoveredAt ?? new Date(),
      fingerprint,
      input.status ?? "discovered"
    ]
  );

  return toTopic(result.rows[0]);
}

export async function getRecentTopics(agentId: string, limit = 20): Promise<DiscoveredTopic[]> {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100);
  const result = await database().query<TopicRow>(
    `SELECT id, agent_id, title, summary, source_url, source_name, source_published_at, discovered_at, fingerprint, status
     FROM discovered_topics
     WHERE agent_id = $1
     ORDER BY discovered_at DESC, id DESC
     LIMIT $2`,
    [agentId, safeLimit]
  );

  return result.rows.map(toTopic);
}

export async function saveEditorialDecision(input: SaveEditorialDecisionInput): Promise<EditorialDecision> {
  const reason = requiredText(input.reason, "Decision reason", 1_000);
  if (input.score !== undefined && input.score !== null && (!Number.isFinite(input.score) || input.score < 0 || input.score > 100)) {
    throw new Error("Decision score must be between 0 and 100.");
  }

  return withTransaction(async (client: PoolClient) => {
    const decisionResult = await client.query<DecisionRow>(
      `INSERT INTO editorial_decisions (topic_id, decision, reason, score, decided_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (topic_id) DO UPDATE SET
         decision = EXCLUDED.decision,
         reason = EXCLUDED.reason,
         score = EXCLUDED.score,
         decided_at = EXCLUDED.decided_at
       RETURNING topic_id, decision, reason, score, decided_at`,
      [input.topicId, input.decision, reason, input.score ?? null, input.decidedAt ?? new Date()]
    );
    const topicResult = await client.query(
      "UPDATE discovered_topics SET status = $2 WHERE id = $1",
      [input.topicId, input.decision]
    );

    if (topicResult.rowCount !== 1) {
      throw new Error("Cannot save a decision for a topic that does not exist.");
    }

    return toDecision(decisionResult.rows[0]);
  });
}

export async function savePublishedPost(input: SavePublishedPostInput): Promise<FeedPost> {
  const text = requiredText(input.text, "Post text", 5_000);
  const rationale = requiredText(input.rationale, "Post rationale", 2_000);
  const sources = normalizeSourceUrls(input.sourceUrls);
  const postId = createId("post");
  const createdAt = input.createdAt ?? new Date();

  return withTransaction(async (client: PoolClient) => {
    if (input.topicId) {
      const topicResult = await client.query(
        "SELECT id FROM discovered_topics WHERE id = $1 AND agent_id = $2",
        [input.topicId, input.agentId]
      );
      if (topicResult.rowCount !== 1) {
        throw new Error("The selected topic does not belong to this agent.");
      }
    }

    const postResult = await client.query<PostRow>(
      `INSERT INTO posts (id, agent_id, topic_id, text, rationale, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, text, rationale, created_at`,
      [postId, input.agentId, input.topicId ?? null, text, rationale, createdAt]
    );

    for (const [position, sourceUrl] of sources.entries()) {
      await client.query(
        "INSERT INTO post_sources (post_id, position, url) VALUES ($1, $2, $3)",
        [postId, position, sourceUrl]
      );
    }

    if (input.topicId) {
      await client.query("UPDATE discovered_topics SET status = 'published' WHERE id = $1", [input.topicId]);
    }

    const post = postResult.rows[0];
    return {
      id: post.id,
      createdAt: post.created_at.toISOString(),
      text: post.text,
      rationale: post.rationale,
      sources
    };
  });
}

export async function getPublishedPosts(agentId: string): Promise<FeedPost[]> {
  const postsResult = await database().query<PostRow>(
    `SELECT id, text, rationale, created_at
     FROM posts
     WHERE agent_id = $1
     ORDER BY created_at DESC, id DESC`,
    [agentId]
  );

  if (postsResult.rows.length === 0) {
    return [];
  }

  const postIds = postsResult.rows.map((post) => post.id);
  const sourcesResult = await database().query<PostSourceRow>(
    `SELECT post_id, url
     FROM post_sources
     WHERE post_id = ANY($1::text[])
     ORDER BY position ASC`,
    [postIds]
  );
  const sourcesByPost = new Map<string, string[]>();

  for (const source of sourcesResult.rows) {
    const sources = sourcesByPost.get(source.post_id) ?? [];
    sources.push(source.url);
    sourcesByPost.set(source.post_id, sources);
  }

  return postsResult.rows.map((post) => ({
    id: post.id,
    createdAt: post.created_at.toISOString(),
    text: post.text,
    rationale: post.rationale,
    sources: sourcesByPost.get(post.id) ?? []
  }));
}

export async function recordAgentRun(input: RecordAgentRunInput): Promise<AgentRun> {
  const startedAt = input.startedAt ?? new Date();
  const finishedAt = input.status === "running" ? null : input.finishedAt ?? new Date();

  return withTransaction(async (client: PoolClient) => {
    const result = await client.query<AgentRunRow>(
      `INSERT INTO agent_runs (
         id, agent_id, status, stage, selected_topic_id, published_post_id, error_summary, started_at, finished_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, agent_id, status, stage, selected_topic_id, published_post_id, error_summary, started_at, finished_at`,
      [
        createId("run"),
        input.agentId,
        input.status,
        optionalText(input.stage, 160),
        input.selectedTopicId ?? null,
        input.publishedPostId ?? null,
        optionalText(input.errorSummary, 500),
        startedAt,
        finishedAt
      ]
    );

    await client.query(
      "UPDATE agents SET last_run_at = $2, updated_at = NOW() WHERE id = $1",
      [input.agentId, finishedAt ?? startedAt]
    );
    return toAgentRun(result.rows[0]);
  });
}

export async function getRecentAgentActivity(agentId: string, limit = 20): Promise<AgentRun[]> {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100);
  const result = await database().query<AgentRunRow>(
    `SELECT id, agent_id, status, stage, selected_topic_id, published_post_id, error_summary, started_at, finished_at
     FROM agent_runs
     WHERE agent_id = $1
     ORDER BY started_at DESC, id DESC
     LIMIT $2`,
    [agentId, safeLimit]
  );

  return result.rows.map(toAgentRun);
}
