import { NextRequest, NextResponse } from "next/server";
import { buildPersona } from "../../../../ai/persona/builder.ts";
import { getAgentById, getPublishedPosts } from "../../../../lib/agents.ts";
import { database } from "../../../../lib/db.ts";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");

  if (!agentId || !agentId.trim()) {
    return NextResponse.json({ error: "Query parameter 'agentId' is required." }, { status: 400 });
  }

  const db = database();

  try {
    const agent = await getAgentById(agentId);
    if (!agent) {
      return NextResponse.json({ error: `Agent with ID '${agentId}' was not found.` }, { status: 404 });
    }

    const personaDef = buildPersona(agent.persona);

    // Query discovered topics breakdown
    const topicStatsRes = await db.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text as count
       FROM discovered_topics
       WHERE agent_id = $1
       GROUP BY status`,
      [agentId]
    );

    const topicStats: Record<string, number> = {
      discovered: 0,
      selected: 0,
      rejected: 0,
      published: 0,
      failed: 0
    };

    for (const row of topicStatsRes.rows) {
      topicStats[row.status] = parseInt(row.count, 10);
    }

    // Query recent discovered topics
    const recentTopicsRes = await db.query<{
      id: string;
      title: string;
      summary: string | null;
      source_name: string;
      source_url: string;
      status: string;
      discovered_at: Date;
    }>(
      `SELECT id, title, summary, source_name, source_url, status, discovered_at
       FROM discovered_topics
       WHERE agent_id = $1
       ORDER BY discovered_at DESC, id DESC
       LIMIT 15`,
      [agentId]
    );

    // Query recent editorial decisions
    const decisionsRes = await db.query<{
      topic_id: string;
      topic_title: string;
      decision: string;
      score: number | null;
      reason: string;
      decided_at: Date;
    }>(
      `SELECT ed.topic_id, dt.title as topic_title, ed.decision, ed.score, ed.reason, ed.decided_at
       FROM editorial_decisions ed
       JOIN discovered_topics dt ON ed.topic_id = dt.id
       WHERE dt.agent_id = $1
       ORDER BY ed.decided_at DESC, ed.topic_id DESC
       LIMIT 15`,
      [agentId]
    );

    // Query published posts
    const posts = await getPublishedPosts(agentId);

    // Query memory outbox records
    const outboxRes = await db.query<{
      id: string;
      memory_id: string;
      status: string;
      attempts: number;
      last_error: string | null;
      created_at: Date;
    }>(
      `SELECT id, memory_id, status, attempts, last_error, created_at
       FROM memory_outbox
       WHERE agent_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 15`,
      [agentId]
    );

    // Query recent agent runs
    const runsRes = await db.query<{
      id: string;
      status: string;
      stage: string | null;
      started_at: Date;
      finished_at: Date | null;
      error_summary: string | null;
    }>(
      `SELECT id, status, stage, started_at, finished_at, error_summary
       FROM agent_runs
       WHERE agent_id = $1
       ORDER BY started_at DESC, id DESC
       LIMIT 10`,
      [agentId]
    );

    return NextResponse.json(
      {
        agent: {
          id: agent.id,
          name: agent.persona.name,
          domain: agent.persona.domain,
          tagline: personaDef.tagline,
          processingStatus: agent.processingStatus,
          nextRunAt: agent.nextRunAt,
          consecutiveFailures: agent.consecutiveFailures,
          createdAt: agent.createdAt
        },
        metrics: {
          topicsDiscoveredTotal: Object.values(topicStats).reduce((a, b) => a + b, 0),
          topicsPendingEvaluation: topicStats.discovered || 0,
          topicsSelected: topicStats.selected || 0,
          topicsRejected: topicStats.rejected || 0,
          postsPublished: topicStats.published || 0,
          outboxRecordsTotal: outboxRes.rows.length
        },
        topics: recentTopicsRes.rows.map((t) => ({
          id: t.id,
          title: t.title,
          summary: t.summary,
          sourceName: t.source_name,
          sourceUrl: t.source_url,
          status: t.status,
          discoveredAt: t.discovered_at.toISOString()
        })),
        editorialDecisions: decisionsRes.rows.map((d) => ({
          id: d.topic_id,
          topicId: d.topic_id,
          topicTitle: d.topic_title,
          decision: d.decision,
          score: d.score,
          reason: d.reason,
          decidedAt: d.decided_at.toISOString()
        })),
        posts,
        outboxRecords: outboxRes.rows.map((o) => ({
          id: o.id,
          memoryId: o.memory_id,
          status: o.status,
          attempts: o.attempts,
          lastError: o.last_error,
          createdAt: o.created_at.toISOString()
        })),
        recentRuns: runsRes.rows.map((r) => ({
          id: r.id,
          status: r.status,
          stage: r.stage,
          startedAt: r.started_at.toISOString(),
          finishedAt: r.finished_at ? r.finished_at.toISOString() : null,
          errorSummary: r.error_summary
        }))
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error(`[API /api/agent/status] Failed for agent ${agentId}:`, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
