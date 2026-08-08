import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePendingTopics } from "../src/editorial/engine.ts";
import { createAgent, saveDiscoveredTopic, saveEditorialDecision } from "../src/lib/agents.ts";
import { database } from "../src/lib/db.ts";
import { BreethMemoryProvider } from "../src/memory/providers/breeth.ts";
import { MockMemoryProvider } from "../src/memory/providers/mock.ts";
import {
  getPendingOutboxRecords,
  getRecentAgentMemories,
  saveAgentMemory
} from "../src/memory/repository.ts";
import { syncAgentOutbox } from "../src/memory/sync.ts";
import { publishSelectedTopics } from "../src/publishing/engine.ts";
import { runAgentCycle } from "../src/worker/index.ts";

if (!process.env.DATABASE_URL) {
  test("persistent agent memory and outbox test suite", { skip: "DATABASE_URL is not configured" }, () => {});
} else {
  test("persistent agent memory and outbox test suite", async (context) => {
    const pool = database();
    const createdAgentIds: string[] = [];

    try {
      await context.test("published post creates memory record and outbox entry in PostgreSQL", async () => {
        const agent = await createAgent({ name: "Memory Test Agent", domain: "AI Systems" });
        createdAgentIds.push(agent.id);

        const topic = await saveDiscoveredTopic({
          agentId: agent.id,
          title: "Distributed GPU Memory Optimization",
          summary: "Technique reducing memory footprint by 40%.",
          sourceUrl: "https://example.com/gpu-mem",
          status: "selected"
        });

        await saveEditorialDecision({
          topicId: topic.id,
          decision: "selected",
          reason: "High empirical engineering value.",
          score: 92
        });

        const pubResult = await publishSelectedTopics(agent);
        assert.equal(pubResult.postsGeneratedCount, 1);

        // Verify memory creation
        const memories = await getRecentAgentMemories(agent.id, 10);
        assert.equal(memories.length, 1);
        assert.equal(memories[0].postId, pubResult.publishedPosts[0].id);
        assert.equal(memories[0].topicTitle, "Distributed GPU Memory Optimization");
        assert.ok(memories[0].postText);
        assert.ok(memories[0].sourceUrls.includes("https://example.com/gpu-mem"));

        // Verify outbox entry creation
        const outboxRecords = await getPendingOutboxRecords(agent.id, 10);
        assert.equal(outboxRecords.length, 1);
        assert.equal(outboxRecords[0].memoryId, memories[0].id);
        assert.equal(outboxRecords[0].status, "pending");
      });

      await context.test("MockMemoryProvider syncs outbox items to 'synced' status", async () => {
        const agent = await createAgent({ name: "Sync Agent", domain: "Cloud AI" });
        createdAgentIds.push(agent.id);

        const topic = await saveDiscoveredTopic({
          agentId: agent.id,
          title: "Cloud Native Inference Serving",
          summary: "Kubernetes operator for LLM deployment.",
          sourceUrl: "https://example.com/cloud/k8s-llm",
          status: "selected"
        });

        await saveEditorialDecision({
          topicId: topic.id,
          decision: "selected",
          reason: "Useful cloud deployment architecture.",
          score: 85
        });

        await publishSelectedTopics(agent);

        const mockProvider = new MockMemoryProvider();
        const syncRes = await syncAgentOutbox(agent.id, mockProvider);

        assert.equal(syncRes.attemptedCount, 1);
        assert.equal(syncRes.syncedCount, 1);
        assert.equal(syncRes.failedCount, 0);

        // Verify outbox record status updated to 'synced'
        const pendingAfterSync = await getPendingOutboxRecords(agent.id, 10);
        assert.equal(pendingAfterSync.length, 0);
      });

      await context.test("memory-aware editorial evaluation rejects candidate topics repetitive with published memories", async () => {
        const agent = await createAgent({ name: "Deduplication Agent", domain: "Security" });
        createdAgentIds.push(agent.id);

        // Publish an initial topic to create published memory history
        const initialTopic = await saveDiscoveredTopic({
          agentId: agent.id,
          title: "Linux Kernel Vulnerability CVE-2026-1001",
          summary: "Privilege escalation flaw in kernel memory subsystem.",
          sourceUrl: "https://example.com/sec/cve-1001",
          status: "selected"
        });

        await saveEditorialDecision({
          topicId: initialTopic.id,
          decision: "selected",
          reason: "Critical kernel patch.",
          score: 95
        });

        await publishSelectedTopics(agent);

        // Verify memory was recorded
        const memories = await getRecentAgentMemories(agent.id);
        assert.equal(memories.length, 1);

        // Now discover a candidate topic that is repetitive (contains 'repetitive topic' or shared context)
        const candidateRepetitive = await saveDiscoveredTopic({
          agentId: agent.id,
          title: "Repetitive Topic: Linux Kernel Vulnerability CVE-2026-1001",
          summary: "Another article discussing the exact same CVE privilege escalation flaw.",
          sourceUrl: "https://another-blog.example.com/sec/cve-1001",
          status: "discovered"
        });

        const evalResult = await evaluatePendingTopics(agent);

        assert.equal(evalResult.evaluatedCount, 1);
        assert.equal(evalResult.rejectedCount, 1);

        const decisionRow = await pool.query(
          "SELECT decision, reason FROM editorial_decisions WHERE topic_id = $1",
          [candidateRepetitive.id]
        );
        assert.equal(decisionRow.rows[0].decision, "rejected");
        assert.ok(decisionRow.rows[0].reason.includes("repetitive"));
      });

      await context.test("failed sync does not fail post creation or delete published memory", async () => {
        const agent = await createAgent({ name: "Fault Tolerant Agent", domain: "Networking" });
        createdAgentIds.push(agent.id);

        const topic = await saveDiscoveredTopic({
          agentId: agent.id,
          title: "Fail Sync Topic - Network Protocols",
          summary: "eBPF packet processing benchmarks.",
          sourceUrl: "https://example.com/ebpf-bench",
          status: "selected"
        });

        await saveEditorialDecision({
          topicId: topic.id,
          decision: "selected",
          reason: "High technical signal.",
          score: 90
        });

        // Publish post (triggers saveAgentMemory and enqueues outbox record)
        const pubResult = await publishSelectedTopics(agent);
        assert.equal(pubResult.postsGeneratedCount, 1);

        // Sync with failing provider
        const mockProvider = new MockMemoryProvider();
        const syncRes = await syncAgentOutbox(agent.id, mockProvider);

        assert.equal(syncRes.failedCount, 1);

        // Post must still exist and be published
        const posts = await pool.query("SELECT id FROM posts WHERE id = $1", [pubResult.publishedPosts[0].id]);
        assert.equal(posts.rows.length, 1);

        // Memory must still exist
        const memories = await getRecentAgentMemories(agent.id);
        assert.equal(memories.length, 1);

        // Outbox record should exist with 'failed' status and attempts = 1
        const outboxRow = await pool.query(
          "SELECT status, attempts, last_error FROM memory_outbox WHERE agent_id = $1",
          [agent.id]
        );
        assert.equal(outboxRow.rows[0].status, "failed");
        assert.equal(outboxRow.rows[0].attempts, 1);
        assert.ok(outboxRow.rows[0].last_error.includes("timeout"));
      });

      await context.test("BreethMemoryProvider handles missing BREETH_API_KEY gracefully without crashing", async () => {
        const breethProvider = new BreethMemoryProvider(); // unconfigured
        const payload = {
          memoryId: "mem_test",
          agentId: "agent_test",
          postId: "post_test",
          topicTitle: "Test Title",
          postText: "Test Text",
          rationale: "Test Rationale",
          sourceUrls: ["https://example.com"],
          publishedAt: new Date().toISOString()
        };

        const res = await breethProvider.syncMemory(payload);
        assert.equal(res.success, false);
        assert.ok(res.error?.includes("BREETH_API_KEY is not configured"));
      });

      await context.test("full autonomous worker cycle end-to-end: discovery -> editorial -> publishing -> memory -> outbox sync", async () => {
        const agent = await createAgent({ name: "Full Cycle Phase 8 Agent", domain: "Quantum Computing" });
        createdAgentIds.push(agent.id);

        const mockRun = {
          id: "run_phase8_full",
          agentId: agent.id,
          status: "running" as const,
          stage: "claimed",
          selectedTopicId: null,
          publishedPostId: null,
          errorSummary: null,
          startedAt: new Date().toISOString(),
          finishedAt: null
        };

        const cycleRes = await runAgentCycle({ agent, run: mockRun });
        assert.equal(cycleRes.stage, "published");

        // Verify memories were recorded
        const memories = await getRecentAgentMemories(agent.id);
        assert.ok(memories.length >= 1);

        // Verify outbox records were synced by worker
        const outboxRows = await pool.query("SELECT status FROM memory_outbox WHERE agent_id = $1", [agent.id]);
        assert.ok(outboxRows.rows.length >= 1);
        assert.equal(outboxRows.rows[0].status, "synced");
      });
    } finally {
      if (createdAgentIds.length > 0) {
        await pool.query("DELETE FROM agents WHERE id = ANY($1::text[])", [createdAgentIds]);
      }
      await pool.end();
    }
  });
}
