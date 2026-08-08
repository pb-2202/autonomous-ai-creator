import assert from "node:assert/strict";
import test from "node:test";
import { AiService } from "../src/ai/service.ts";
import { evaluatePendingTopics } from "../src/editorial/engine.ts";
import {
  createAgent,
  getPendingDiscoveredTopics,
  getRecentTopics,
  saveDiscoveredTopic
} from "../src/lib/agents.ts";
import { database } from "../src/lib/db.ts";
import { runAgentCycle } from "../src/worker/index.ts";

if (!process.env.DATABASE_URL) {
  test("editorial decision engine test suite", { skip: "DATABASE_URL is not configured" }, () => {});
} else {
  test("editorial decision engine test suite", async (context) => {
    const pool = database();
    const createdAgentIds: string[] = [];

    try {
      await context.test("evaluates relevant topics as selected and irrelevant topics as rejected", async () => {
        const agent = await createAgent({ name: "Security Curator", domain: "Cybersecurity & Systems" });
        createdAgentIds.push(agent.id);

        const goodTopic = await saveDiscoveredTopic({
          agentId: agent.id,
          title: "Critical Vulnerability Discovered in Core Kernel Driver",
          summary: "A memory safety vulnerability was patched in Linux kernel 6.10, preventing privilege escalation.",
          sourceUrl: "https://example.com/security/kernel-patch",
          sourceName: "Security Weekly",
          status: "discovered"
        });

        const badTopic = await saveDiscoveredTopic({
          agentId: agent.id,
          title: "Top 10 Consumer Shopping Deals and Discounts",
          summary: "Best seasonal gadget discounts on consumer electronics.",
          sourceUrl: "https://example.com/deals/shopping-discount",
          sourceName: "Bargain News",
          status: "discovered"
        });

        const result = await evaluatePendingTopics(agent);

        assert.equal(result.evaluatedCount, 2);
        assert.equal(result.selectedCount, 1);
        assert.equal(result.rejectedCount, 1);
        assert.equal(result.failedCount, 0);

        // Check persisted decisions in Postgres
        const decisionsResult = await pool.query(
          "SELECT topic_id, decision, reason, score FROM editorial_decisions WHERE topic_id IN ($1, $2) ORDER BY decided_at ASC",
          [goodTopic.id, badTopic.id]
        );

        assert.equal(decisionsResult.rows.length, 2);
        const goodDecision = decisionsResult.rows.find((r) => r.topic_id === goodTopic.id);
        const badDecision = decisionsResult.rows.find((r) => r.topic_id === badTopic.id);

        assert.equal(goodDecision?.decision, "selected");
        assert.ok(goodDecision?.score >= 50);
        assert.ok(goodDecision?.reason.length > 5);

        assert.equal(badDecision?.decision, "rejected");
        assert.ok(badDecision?.score < 50);
        assert.ok(badDecision?.reason.length > 5);

        // Verify updated topic status in database
        const updatedTopics = await getRecentTopics(agent.id);
        const goodUpdated = updatedTopics.find((t) => t.id === goodTopic.id);
        const badUpdated = updatedTopics.find((t) => t.id === badTopic.id);

        assert.equal(goodUpdated?.status, "selected");
        assert.equal(badUpdated?.status, "rejected");
      });

      await context.test("ensures idempotency: already evaluated topics are not re-evaluated", async () => {
        const agent = await createAgent({ name: "Idempotency Agent", domain: "AI Infrastructure" });
        createdAgentIds.push(agent.id);

        await saveDiscoveredTopic({
          agentId: agent.id,
          title: "GPU Optimization for Transformer Training",
          summary: "Technical benchmarks showing 30% speedup.",
          sourceUrl: "https://example.com/gpu-opt",
          sourceName: "AI Research",
          status: "discovered"
        });

        // First evaluation cycle
        const firstRun = await evaluatePendingTopics(agent);
        assert.equal(firstRun.evaluatedCount, 1);

        // Pending queue should now be empty
        const pendingAfterFirst = await getPendingDiscoveredTopics(agent.id);
        assert.equal(pendingAfterFirst.length, 0);

        // Second evaluation cycle
        const secondRun = await evaluatePendingTopics(agent);
        assert.equal(secondRun.evaluatedCount, 0);
        assert.equal(secondRun.selectedCount, 0);
        assert.equal(secondRun.rejectedCount, 0);
      });

      await context.test("handles individual AI provider failure gracefully without failing the entire run", async () => {
        const agent = await createAgent({ name: "Resilient Agent", domain: "Hardware" });
        createdAgentIds.push(agent.id);

        const topic1 = await saveDiscoveredTopic({
          agentId: agent.id,
          title: "Hardware Benchmark Results",
          summary: "Empirical latency test.",
          sourceUrl: "https://example.com/hw-bench",
          status: "discovered"
        });

        const topic2 = await saveDiscoveredTopic({
          agentId: agent.id,
          title: "Failing Candidate Topic",
          summary: "This will fail in mock provider.",
          sourceUrl: "https://example.com/fail-topic",
          status: "discovered"
        });

        // Mock AiService that throws on topic2
        const mockAiService = new AiService(agent.persona);
        const originalEval = mockAiService.evaluateCandidateTopic.bind(mockAiService);
        mockAiService.evaluateCandidateTopic = async (cand) => {
          if (cand.title.includes("Failing Candidate Topic")) {
            throw new Error("Simulated LLM API Rate Limit Error");
          }
          return originalEval(cand);
        };

        const runResult = await evaluatePendingTopics(agent, { aiService: mockAiService });

        assert.equal(runResult.evaluatedCount, 1);
        assert.equal(runResult.failedCount, 1);
        assert.equal(runResult.failedTopics[0].topicId, topic2.id);

        // Topic 1 should be successfully evaluated and persisted
        const topic1Check = (await getRecentTopics(agent.id)).find((t) => t.id === topic1.id);
        assert.equal(topic1Check?.status, "selected");

        // Topic 2 should remain 'discovered' so it can be retried later
        const topic2Check = (await getRecentTopics(agent.id)).find((t) => t.id === topic2.id);
        assert.equal(topic2Check?.status, "discovered");
      });

      await context.test("worker executes discovery and editorial evaluation in single cycle", async () => {
        const agent = await createAgent({ name: "Worker Editorial Agent", domain: "Robotics & Automation" });
        createdAgentIds.push(agent.id);

        const mockRun = {
          id: "run_test_editorial",
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
        assert.equal(result.stage, "editorial");

        // Verify that topics were evaluated in PostgreSQL
        const decisions = await pool.query(
          "SELECT d.decision FROM editorial_decisions d JOIN discovered_topics t ON d.topic_id = t.id WHERE t.agent_id = $1",
          [agent.id]
        );
        assert.ok(decisions.rows.length > 0);
      });
    } finally {
      if (createdAgentIds.length > 0) {
        await pool.query("DELETE FROM agents WHERE id = ANY($1::text[])", [createdAgentIds]);
      }
      await pool.end();
    }
  });
}
