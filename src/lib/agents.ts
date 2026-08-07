import type { PoolClient } from "pg";
import { database, withTransaction } from "@/lib/db";
import { createId } from "@/lib/ids";
import type { FeedPost, Source } from "@/lib/types";

export const DEFAULT_PERSONA =
  "Signal over hype: a clear-eyed AI and developer-tools analyst who explains what changed, why it matters, and the practical caveat.";

type PostRow = {
  id: string;
  agent_id: string;
  content: string;
  rationale: string;
  published_at: Date;
};

type SourceRow = {
  post_id: string;
  title: string;
  url: string;
  published_at: Date | null;
};

export async function initializeAgent(): Promise<{ agentId: string; persona: string }> {
  const agentId = createId("agent");
  const jobId = createId("job");

  await withTransaction(async (client: PoolClient) => {
    await client.query(
      "INSERT INTO agents (id, persona) VALUES ($1, $2)",
      [agentId, DEFAULT_PERSONA]
    );
    await client.query(
      "INSERT INTO scheduled_jobs (id, agent_id, kind, status, next_run_at) VALUES ($1, $2, $3, $4, NOW())",
      [jobId, agentId, "agent_cycle", "pending"]
    );
  });

  return { agentId, persona: DEFAULT_PERSONA };
}

export async function getFeed(agentId: string): Promise<FeedPost[]> {
  const db = database();
  const postsResult = await db.query<PostRow>(
    "SELECT id, agent_id, content, rationale, published_at FROM posts WHERE agent_id = $1 ORDER BY published_at DESC, id DESC",
    [agentId]
  );

  if (postsResult.rows.length === 0) {
    return [];
  }

  const postIds = postsResult.rows.map((post) => post.id);
  const sourcesResult = await db.query<SourceRow>(
    "SELECT post_id, title, url, published_at FROM post_sources WHERE post_id = ANY($1::text[]) ORDER BY position ASC",
    [postIds]
  );

  const sourcesByPost = new Map<string, Source[]>();
  for (const source of sourcesResult.rows) {
    const sources = sourcesByPost.get(source.post_id) ?? [];
    sources.push({
      title: source.title,
      url: source.url,
      publishedAt: source.published_at?.toISOString() ?? null
    });
    sourcesByPost.set(source.post_id, sources);
  }

  return postsResult.rows.map((post) => ({
    id: post.id,
    agentId: post.agent_id,
    content: post.content,
    rationale: post.rationale,
    publishedAt: post.published_at.toISOString(),
    sources: sourcesByPost.get(post.id) ?? []
  }));
}
