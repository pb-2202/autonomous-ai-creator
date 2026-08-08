import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../src/app/api/agent/feed/route.ts";
import { evaluatePendingTopics } from "../src/editorial/engine.ts";
import { createAgent, getPublishedPosts, saveDiscoveredTopic, saveEditorialDecision } from "../src/lib/agents.ts";
import { database } from "../src/lib/db.ts";
import { publishSelectedTopics } from "../src/publishing/engine.ts";
import { runAgentCycle } from "../src/worker/index.ts";

if (!process.env.DATABASE_URL) {
  test("publishing subsystem test suite", { skip: "DATABASE_URL is not configured" }, () => {});
} else {
  test("publishing subsystem test suite", async (context) => {
    const pool = database();
    const createdAgentIds: string[] = [];

    try {
      await context.test("generates and atomically persists a post with rationale and sources for a selected topic", async () => {
        const agent = await createAgent({ name: "Publishing Test Agent", domain: "Cloud Architecture" });
        createdAgentIds.push(agent.id);

        const selectedTopic = await saveDiscoveredTopic({
          agentId: agent.id,
          title: "Serverless Performance Optimization Benchmarks",
          summary: "Detailed benchmarks showing 40% cold start latency reduction.",
          sourceUrl: "https://example.com/cloud/serverless-bench",
          sourceName: "Cloud Engineering Journal",
          status: "selected"
        });

        await saveEditorialDecision({
          topicId: selectedTopic.id,
          decision: "selected",
          reason: "High empirical signal regarding serverless runtime performance.",
          score: 90
        });

        const runResult = await publishSelectedTopics(agent);
        assert.equal(runResult.candidateTopicsFound, 1);
        assert.equal(runResult.postsGeneratedCount, 1);
        assert.equal(runResult.publishedPosts.length, 1);

        const published = runResult.publishedPosts[0];
        assert.ok(published.id.startsWith("post_"));
        assert.ok(published.text.length > 10);
        assert.ok(published.rationale.length > 5);
        assert.ok(published.sources.includes("https://example.com/cloud/serverless-bench"));

        // Verify database persistence in posts and post_sources
        const dbPosts = await getPublishedPosts(agent.id);
        assert.equal(dbPosts.length, 1);
        assert.equal(dbPosts[0].id, published.id);
        assert.ok(dbPosts[0].sources.includes("https://example.com/cloud/serverless-bench"));
      });

      await context.test("ensures idempotency: already published topic is not re-published on subsequent runs", async () => {
        const agent = await createAgent({ name: "Idempotence Publisher", domain: "Data Science" });
        createdAgentIds.push(agent.id);

        const topic = await saveDiscoveredTopic({
          agentId: agent.id,
          title: "Distributed Training Scaling Limits",
          summary: "Analysis of cross-datacenter interconnect bottlenecks.",
          sourceUrl: "https://example.com/data/scaling-limits",
          status: "selected"
        });

        await saveEditorialDecision({
          topicId: topic.id,
          decision: "selected",
          reason: "Critical infrastructure insight.",
          score: 88
        });

        // Run 1: Should publish 1 post
        const run1 = await publishSelectedTopics(agent);
        assert.equal(run1.postsGeneratedCount, 1);

        // Run 2: Should find 0 candidate topics for publishing
        const run2 = await publishSelectedTopics(agent);
        assert.equal(run2.candidateTopicsFound, 0);
        assert.equal(run2.postsGeneratedCount, 0);

        // Total published posts should remain 1
        const posts = await getPublishedPosts(agent.id);
        assert.equal(posts.length, 1);
      });

      await context.test("GET /api/agent/feed API route returns generated posts in evaluator contract format", async () => {
        const agent = await createAgent({ name: "Feed Route Agent", domain: "AI Security" });
        createdAgentIds.push(agent.id);

        // Empty feed test
        const emptyReq = new Request(`http://localhost/api/agent/feed?agentId=${agent.id}`);
        // @ts-expect-error NextRequest compatibility for test runner
        const emptyRes = await GET(emptyReq);
        assert.equal(emptyRes.status, 200);
        const emptyJson = await emptyRes.json();
        assert.deepEqual(emptyJson, { posts: [] });

        // Add topic, evaluate, publish
        const topic = await saveDiscoveredTopic({
          agentId: agent.id,
          title: "LLM Prompt Injection Vulnerability Report",
          summary: "Adversarial evaluation of security controls.",
          sourceUrl: "https://example.com/security/prompt-injection",
          status: "discovered"
        });

        await evaluatePendingTopics(agent);
        await publishSelectedTopics(agent);

        // Feed API should now return 1 post
        const feedReq = new Request(`http://localhost/api/agent/feed?agentId=${agent.id}`);
        // @ts-expect-error NextRequest compatibility for test runner
        const feedRes = await GET(feedReq);
        assert.equal(feedRes.status, 200);
        const feedJson = await feedRes.json();

        assert.ok(Array.isArray(feedJson.posts));
        assert.equal(feedJson.posts.length, 1);
        const item = feedJson.posts[0];
        assert.ok(item.id.startsWith("post_"));
        assert.ok(item.createdAt);
        assert.ok(item.text);
        assert.ok(item.rationale);
        assert.ok(Array.isArray(item.sources));
        assert.ok(item.sources.includes("https://example.com/security/prompt-injection"));
      });

      await context.test("full autonomous worker cycle end-to-end: discovery -> editorial -> generation -> feed API", async () => {
        const agent = await createAgent({ name: "Full Pipeline Agent", domain: "Autonomous Robotics" });
        createdAgentIds.push(agent.id);

        const mockRun = {
          id: "run_full_pipeline",
          agentId: agent.id,
          status: "running" as const,
          stage: "claimed",
          selectedTopicId: null,
          publishedPostId: null,
          errorSummary: null,
          startedAt: new Date().toISOString(),
          finishedAt: null
        };

        const result = await runAgentCycle({ agent, run: mockRun });
        assert.equal(result.stage, "published");

        // Verify that post exists in feed API
        const feedReq = new Request(`http://localhost/api/agent/feed?agentId=${agent.id}`);
        // @ts-expect-error NextRequest compatibility for test runner
        const feedRes = await GET(feedReq);
        assert.equal(feedRes.status, 200);
        const feedJson = await feedRes.json();

        assert.ok(feedJson.posts.length >= 1);
        assert.ok(feedJson.posts[0].sources.length >= 1);
      });
    } finally {
      if (createdAgentIds.length > 0) {
        await pool.query("DELETE FROM agents WHERE id = ANY($1::text[])", [createdAgentIds]);
      }
      await pool.end();
    }
  });
}
