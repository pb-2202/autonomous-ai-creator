import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePendingTopics } from "../src/editorial/engine.ts";
import { createAgent, saveDiscoveredTopic } from "../src/lib/agents.ts";
import { database } from "../src/lib/db.ts";
import { BreethMemoryProvider } from "../src/memory/providers/breeth.ts";
import { OpenAiLlmProvider } from "../src/ai/providers/openai.ts";
import { MockLlmProvider } from "../src/ai/providers/mock.ts";
import { AiService } from "../src/ai/service.ts";

if (!process.env.DATABASE_URL) {
  test("OpenAI and provider validation test suite", { skip: "DATABASE_URL is not configured" }, () => {});
} else {
  test("OpenAI and provider validation test suite", async (context) => {
    const pool = database();
    const createdAgentIds: string[] = [];

    try {
      await context.test("OpenAiLlmProvider throws actionable error when OPENAI_API_KEY is missing", async () => {
        const provider = new OpenAiLlmProvider(""); // empty API key
        await assert.rejects(
          async () => {
            await provider.generateText({
              messages: [{ role: "user", content: "Test ping" }]
            });
          },
          (err: Error) => {
            assert.ok(err.message.includes("OPENAI_API_KEY is not configured"));
            return true;
          }
        );
      });

      await context.test("OpenAiLlmProvider structured output throws actionable error when OPENAI_API_KEY is missing", async () => {
        const provider = new OpenAiLlmProvider("");
        await assert.rejects(
          async () => {
            await provider.generateStructured({
              messages: [{ role: "user", content: "Test ping" }],
              schemaDescription: "JSON schema description",
              parse: (input) => JSON.parse(input)
            });
          },
          (err: Error) => {
            assert.ok(err.message.includes("OPENAI_API_KEY is not configured"));
            return true;
          }
        );
      });

      await context.test("provider failure in evaluatePendingTopics is caught safely without corrupting database state", async () => {
        const agent = await createAgent({
          name: "OpenAI Validation Agent",
          domain: "Cybersecurity & Vulnerability Analysis"
        });
        createdAgentIds.push(agent.id);

        const topic = await saveDiscoveredTopic({
          agentId: agent.id,
          title: "Zero-Day Vulnerability in Linux Memory Management",
          summary: "Kernel patch addressing memory disclosure flaw.",
          sourceUrl: "https://example.com/kernel-sec",
          status: "discovered"
        });

        // Instantiate AiService with an unconfigured OpenAiLlmProvider
        const unconfiguredAiService = new AiService(
          agent.persona,
          new OpenAiLlmProvider("")
        );

        const result = await evaluatePendingTopics(agent, { aiService: unconfiguredAiService });

        assert.equal(result.evaluatedCount, 0);
        assert.equal(result.failedCount, 1);
        assert.equal(result.failedTopics.length, 1);
        assert.ok(result.failedTopics[0].error.includes("OPENAI_API_KEY is not configured"));

        // Verify topic status in database remains 'discovered' (un-corrupted)
        const topicRow = await pool.query("SELECT status FROM discovered_topics WHERE id = $1", [topic.id]);
        assert.equal(topicRow.rows[0].status, "discovered");

        // Verify no invalid editorial decision was written
        const decisionRow = await pool.query("SELECT topic_id FROM editorial_decisions WHERE topic_id = $1", [topic.id]);
        assert.equal(decisionRow.rows.length, 0);
      });

      await context.test("MockLlmProvider remains deterministic, offline, and safe", async () => {
        const mockProvider = new MockLlmProvider();
        const text = await mockProvider.generateText({
          messages: [{ role: "user", content: "Greetings" }]
        });
        assert.ok(text.length > 0);

        const structured = await mockProvider.generateStructured<{ decision: string; score: number }>({
          messages: [{ role: "user", content: "evaluate candidate topic" }],
          schemaDescription: "editorial decision",
          parse: (raw) => JSON.parse(raw) as { decision: string; score: number }
        });
        assert.ok(structured.decision);
        assert.ok(typeof structured.score === "number");
      });

      await context.test("BreethMemoryProvider handles unconfigured key cleanly without throwing fatal error", async () => {
        const breethProvider = new BreethMemoryProvider("");
        const syncRes = await breethProvider.syncMemory({
          memoryId: "mem_123",
          agentId: "agent_123",
          postId: "post_123",
          topicTitle: "Topic Title",
          postText: "Post Text",
          rationale: "Rationale",
          sourceUrls: ["https://example.com"],
          publishedAt: new Date().toISOString()
        });

        assert.equal(syncRes.success, false);
        assert.ok(syncRes.error?.includes("BREETH_API_KEY is not configured"));
      });
    } finally {
      if (createdAgentIds.length > 0) {
        await pool.query("DELETE FROM agents WHERE id = ANY($1::text[])", [createdAgentIds]);
      }
      await pool.end();
    }
  });
}
