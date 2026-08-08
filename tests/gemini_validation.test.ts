import assert from "node:assert/strict";
import test from "node:test";
import { GeminiLlmProvider } from "../src/ai/providers/gemini.ts";
import { getLlmProvider } from "../src/ai/providers/factory.ts";
import { AiService } from "../src/ai/service.ts";
import { evaluatePendingTopics } from "../src/editorial/engine.ts";
import { createAgent, saveDiscoveredTopic } from "../src/lib/agents.ts";
import { database } from "../src/lib/db.ts";

if (!process.env.DATABASE_URL) {
  test("Gemini provider validation test suite", { skip: "DATABASE_URL is not configured" }, () => {});
} else {
  test("Gemini provider validation test suite", async (context) => {
    const pool = database();
    const createdAgentIds: string[] = [];

    try {
      await context.test("factory instantiates GeminiLlmProvider when AI_PROVIDER=gemini", async () => {
        const provider = getLlmProvider("gemini");
        assert.equal(provider.name, "gemini");
        assert.ok(provider instanceof GeminiLlmProvider);
      });

      await context.test("GeminiLlmProvider throws actionable error when GEMINI_API_KEY is missing", async () => {
        const provider = new GeminiLlmProvider(""); // empty API key
        await assert.rejects(
          async () => {
            await provider.generateText({
              messages: [{ role: "user", content: "Test ping" }]
            });
          },
          (err: Error) => {
            assert.ok(err.message.includes("GEMINI_API_KEY is not configured"));
            return true;
          }
        );
      });

      await context.test("GeminiLlmProvider structured output throws actionable error when GEMINI_API_KEY is missing", async () => {
        const provider = new GeminiLlmProvider("");
        await assert.rejects(
          async () => {
            await provider.generateStructured({
              messages: [{ role: "user", content: "Test ping" }],
              schemaDescription: "JSON schema description",
              parse: (input) => JSON.parse(input)
            });
          },
          (err: Error) => {
            assert.ok(err.message.includes("GEMINI_API_KEY is not configured"));
            return true;
          }
        );
      });

      await context.test("provider failure in evaluatePendingTopics is caught safely without corrupting database state", async () => {
        const agent = await createAgent({
          name: "Gemini Validation Agent",
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

        // Instantiate AiService with an unconfigured GeminiLlmProvider
        const unconfiguredAiService = new AiService(
          agent.persona,
          new GeminiLlmProvider("")
        );

        const result = await evaluatePendingTopics(agent, { aiService: unconfiguredAiService });

        assert.equal(result.evaluatedCount, 0);
        assert.equal(result.failedCount, 1);
        assert.equal(result.failedTopics.length, 1);
        assert.ok(result.failedTopics[0].error.includes("GEMINI_API_KEY is not configured"));

        // Verify topic status in database remains 'discovered' (un-corrupted)
        const topicRow = await pool.query("SELECT status FROM discovered_topics WHERE id = $1", [topic.id]);
        assert.equal(topicRow.rows[0].status, "discovered");

        // Verify no invalid editorial decision was written
        const decisionRow = await pool.query("SELECT topic_id FROM editorial_decisions WHERE topic_id = $1", [topic.id]);
        assert.equal(decisionRow.rows.length, 0);
      });
    } finally {
      if (createdAgentIds.length > 0) {
        await pool.query("DELETE FROM agents WHERE id = ANY($1::text[])", [createdAgentIds]);
      }
      await pool.end();
    }
  });
}
