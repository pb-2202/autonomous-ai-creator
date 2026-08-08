import assert from "node:assert/strict";
import test from "node:test";
import { POST as initHandler } from "../src/app/api/agent/init/route.ts";
import { GET as feedHandler } from "../src/app/api/agent/feed/route.ts";
import { evaluatePendingTopics } from "../src/editorial/engine.ts";
import { getAgentById, saveDiscoveredTopic, saveEditorialDecision } from "../src/lib/agents.ts";
import { database } from "../src/lib/db.ts";
import { getRecentAgentMemories } from "../src/memory/repository.ts";
import { publishSelectedTopics } from "../src/publishing/engine.ts";
import { processNextJob, runAgentCycle } from "../src/worker/index.ts";

if (!process.env.DATABASE_URL) {
  test("evaluator 48-hour simulation test suite", { skip: "DATABASE_URL is not configured" }, () => {});
} else {
  test("evaluator 48-hour simulation test suite", async (context) => {
    const pool = database();
    const createdAgentIds: string[] = [];

    try {
      await context.test("end-to-end evaluator simulation: init -> empty feed -> worker cycle -> published post -> feed API", async () => {
        // Step 1: Evaluator calls POST /api/agent/init with custom persona
        const initReq = new Request("http://localhost:3000/api/agent/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            persona: {
              name: "Evaluator Simulation Researcher",
              domain: "AI Security & Systems"
            }
          })
        });

        const initRes = await initHandler(initReq);
        assert.equal(initRes.status, 201);
        const initData = (await initRes.json()) as { agentId: string };
        assert.ok(initData.agentId);
        assert.ok(initData.agentId.startsWith("agent_"));

        const agentId = initData.agentId;
        createdAgentIds.push(agentId);

        // Step 2: Evaluator immediately polls feed -> must return empty posts array
        const feedReqInitial = new Request(`http://localhost:3000/api/agent/feed?agentId=${agentId}`);
        // @ts-expect-error NextRequest compatibility for Node test runner
        const feedResInitial = await feedHandler(feedReqInitial);
        assert.equal(feedResInitial.status, 200);
        const feedDataInitial = (await feedResInitial.json()) as { posts: unknown[] };
        assert.deepEqual(feedDataInitial.posts, []);

        // Step 3: Worker claims due job and runs cycle (Discovery -> Editorial -> Publishing -> Memory -> Outbox)
        const agent = await getAgentById(agentId);
        assert.ok(agent);

        const mockRun = {
          id: `run_sim_${Date.now()}`,
          agentId,
          status: "running" as const,
          stage: "claimed",
          selectedTopicId: null,
          publishedPostId: null,
          errorSummary: null,
          startedAt: new Date().toISOString(),
          finishedAt: null
        };

        const cycleResult = await runAgentCycle({ agent, run: mockRun });
        assert.equal(cycleResult.stage, "published");

        // Step 4: Evaluator polls feed API again -> must return published post matching evaluator contract
        const feedReqPublished = new Request(`http://localhost:3000/api/agent/feed?agentId=${agentId}`);
        // @ts-expect-error NextRequest compatibility for Node test runner
        const feedResPublished = await feedHandler(feedReqPublished);
        assert.equal(feedResPublished.status, 200);
        const feedDataPublished = (await feedResPublished.json()) as {
          posts: Array<{
            id: string;
            createdAt: string;
            text: string;
            rationale: string;
            sources: string[];
          }>;
        };

        assert.equal(feedDataPublished.posts.length, 1);
        const post = feedDataPublished.posts[0];
        assert.ok(post.id);
        assert.ok(post.text);
        assert.ok(post.rationale);
        assert.ok(Array.isArray(post.sources));
        assert.ok(post.sources.length > 0);

        // ISO 8601 UTC timestamp check
        assert.ok(!isNaN(Date.parse(post.createdAt)));
        assert.ok(post.createdAt.endsWith("Z"));

        // Step 5: Worker runs cycle 2 -> verifies additional candidate published or feed maintained
        const cycleResult2 = await runAgentCycle({ agent, run: mockRun });
        assert.equal(cycleResult2.stage, "published");

        // @ts-expect-error NextRequest compatibility for Node test runner
        const feedResPostCycle2 = await feedHandler(feedReqPublished);
        const feedDataPostCycle2 = (await feedResPostCycle2.json()) as { posts: unknown[] };
        assert.ok(feedDataPostCycle2.posts.length >= 1);
      });

      await context.test("evaluator simulation: memory repetition protection rejects repetitive candidate topics", async () => {
        // Step 1: Initialize an agent for memory deduplication testing
        const initReq = new Request("http://localhost:3000/api/agent/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            persona: {
              name: "Robotics & Hardware Analyst",
              domain: "Autonomous Systems & Micro-controllers"
            }
          })
        });

        const initRes = await initHandler(initReq);
        const initData = (await initRes.json()) as { agentId: string };
        const agentId = initData.agentId;
        createdAgentIds.push(agentId);

        const agent = await getAgentById(agentId);
        assert.ok(agent);

        // Step 2: Publish an initial topic to create published memory context
        const initialTopic = await saveDiscoveredTopic({
          agentId,
          title: "Micro-controller Zero-Trust Firmware Verification",
          summary: "Cryptographic hardware root-of-trust for embedded robotics.",
          sourceUrl: "https://example.com/robotics/zero-trust-fw",
          status: "selected"
        });

        await saveEditorialDecision({
          topicId: initialTopic.id,
          decision: "selected",
          reason: "High technical signal for embedded robotics.",
          score: 94
        });

        await publishSelectedTopics(agent);

        const memories = await getRecentAgentMemories(agentId);
        assert.equal(memories.length, 1);

        // Step 3: Discover a candidate topic that covers repetitive subject matter
        const repetitiveCandidate = await saveDiscoveredTopic({
          agentId,
          title: "Repetitive Topic: Micro-controller Zero-Trust Firmware Verification",
          summary: "A repetitive article discussing the exact same firmware root-of-trust technique.",
          sourceUrl: "https://another-tech.example.com/robotics/zero-trust",
          status: "discovered"
        });

        // Step 4: Run memory-aware editorial evaluation
        const evalResult = await evaluatePendingTopics(agent);
        assert.equal(evalResult.evaluatedCount, 1);
        assert.equal(evalResult.rejectedCount, 1);

        // Step 5: Verify decision was persisted as rejected with repetitive rationale
        const decisionRow = await pool.query(
          "SELECT decision, reason FROM editorial_decisions WHERE topic_id = $1",
          [repetitiveCandidate.id]
        );
        assert.equal(decisionRow.rows[0].decision, "rejected");
        assert.ok(decisionRow.rows[0].reason.includes("repetitive"));
      });

      await context.test("evaluator simulation: processNextJob loop executes end-to-end without human intervention", async () => {
        // Initialize an agent that will be claimed by processNextJob()
        const initReq = new Request("http://localhost:3000/api/agent/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            persona: {
              name: "Machine Learning Engineer",
              domain: "Distributed LLM Infrastructure"
            }
          })
        });

        const initRes = await initHandler(initReq);
        const initData = (await initRes.json()) as { agentId: string };
        const agentId = initData.agentId;
        createdAgentIds.push(agentId);

        // processNextJob will claim the agent's due job and execute cycle
        const claimed = await processNextJob(agentId);
        assert.equal(claimed, true);

        // Verify feed has published post
        const feedReq = new Request(`http://localhost:3000/api/agent/feed?agentId=${agentId}`);
        // @ts-expect-error NextRequest compatibility for Node test runner
        const feedRes = await feedHandler(feedReq);
        assert.equal(feedRes.status, 200);
        const feedData = (await feedRes.json()) as { posts: unknown[] };
        assert.ok(feedData.posts.length >= 1);
      });
    } finally {
      if (createdAgentIds.length > 0) {
        await pool.query("DELETE FROM agents WHERE id = ANY($1::text[])", [createdAgentIds]);
      }
      await pool.end();
    }
  });
}
