import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server.js";
import { GET } from "../src/app/api/agent/feed/route.ts";
import { POST } from "../src/app/api/agent/init/route.ts";
import {
  createAgent,
  getAgentById,
  getPublishedPosts,
  getRecentAgentActivity,
  getRecentTopics,
  recordAgentRun,
  saveDiscoveredTopic,
  saveEditorialDecision,
  savePublishedPost
} from "../src/lib/agents.ts";
import { database } from "../src/lib/db.ts";

test("POST /api/agent/init rejects an invalid persona", async () => {
  const response = await POST(
    new Request("http://localhost/api/agent/init", {
      method: "POST",
      body: JSON.stringify({ persona: { name: "", domain: 42 } })
    })
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Invalid request body. Expected a JSON persona with name and domain."
  });
});

test("GET /api/agent/feed requires agentId", async () => {
  const response = await GET(new NextRequest("http://localhost/api/agent/feed"));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "agentId is required." });
});

if (!process.env.DATABASE_URL) {
  test("database persistence integration", { skip: "DATABASE_URL is not configured" }, () => {});
} else {
  test("database persistence integration", async (context) => {
    const pool = database();
    const createdAgentIds: string[] = [];

    try {
      await context.test("creates and retrieves an agent", async () => {
        const agent = await createAgent({ name: "Persistence Test", domain: "Test Engineering" });
        createdAgentIds.push(agent.id);

        const retrieved = await getAgentById(agent.id);
        assert.deepEqual(retrieved?.persona, { name: "Persistence Test", domain: "Test Engineering" });
        assert.equal(retrieved?.active, true);
      });

      const agentId = createdAgentIds[0];
      await context.test("stores topics and a deliberate rejection", async () => {
        const olderTopic = await saveDiscoveredTopic({
          agentId,
          title: "Older topic",
          summary: "A topic saved first.",
          sourceUrl: "https://example.com/older-topic",
          sourceName: "Example",
          discoveredAt: new Date("2026-08-07T09:00:00.000Z")
        });
        const newerTopic = await saveDiscoveredTopic({
          agentId,
          title: "Newer topic",
          sourceUrl: "https://example.com/newer-topic",
          discoveredAt: new Date("2026-08-07T10:00:00.000Z")
        });

        const rejected = await saveEditorialDecision({
          topicId: olderTopic.id,
          decision: "rejected",
          reason: "Insufficient practical impact.",
          score: 18
        });
        await saveEditorialDecision({
          topicId: newerTopic.id,
          decision: "selected",
          reason: "Clear relevance to the persona.",
          score: 92
        });

        const topics = await getRecentTopics(agentId);
        assert.equal(topics[0].id, newerTopic.id);
        assert.equal(topics.find((topic) => topic.id === olderTopic.id)?.status, "rejected");
        assert.equal(rejected.decision, "rejected");
      });

      await context.test("preserves posts and retrieves them newest first", async () => {
        const topics = await getRecentTopics(agentId);
        const selectedTopic = topics.find((topic) => topic.status === "selected");
        assert.ok(selectedTopic);

        const olderPost = await savePublishedPost({
          agentId,
          text: "Older published post",
          rationale: "It establishes persistence behavior.",
          sourceUrls: ["https://example.com/older-source"],
          createdAt: new Date("2026-08-07T11:00:00.000Z")
        });
        const newerPost = await savePublishedPost({
          agentId,
          topicId: selectedTopic.id,
          text: "Newer published post",
          rationale: "It confirms reverse chronological feed ordering.",
          sourceUrls: ["https://example.com/newer-source"],
          createdAt: new Date("2026-08-07T12:00:00.000Z")
        });

        const posts = await getPublishedPosts(agentId);
        assert.notEqual(olderPost.id, newerPost.id);
        assert.deepEqual(posts.map((post) => post.id), [newerPost.id, olderPost.id]);
        assert.deepEqual(posts[0].sources, ["https://example.com/newer-source"]);
        assert.equal(posts.length, 2);
      });

      await context.test("records successful and failed agent runs", async () => {
        const topics = await getRecentTopics(agentId);
        const posts = await getPublishedPosts(agentId);
        const successfulRun = await recordAgentRun({
          agentId,
          status: "succeeded",
          stage: "persist",
          selectedTopicId: topics[0].id,
          publishedPostId: posts[0].id,
          startedAt: new Date("2026-08-07T13:00:00.000Z"),
          finishedAt: new Date("2026-08-07T13:01:00.000Z")
        });
        const failedRun = await recordAgentRun({
          agentId,
          status: "failed",
          stage: "discovery",
          errorSummary: "Test failure summary.",
          startedAt: new Date("2026-08-07T14:00:00.000Z"),
          finishedAt: new Date("2026-08-07T14:01:00.000Z")
        });

        const activity = await getRecentAgentActivity(agentId);
        assert.deepEqual(activity.map((run) => run.id), [failedRun.id, successfulRun.id]);
        assert.equal(activity[0].status, "failed");
        assert.equal(activity[1].status, "succeeded");
      });

      await context.test("initializes through the API and returns an empty feed", async () => {
        const initResponse = await POST(
          new Request("http://localhost/api/agent/init", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ persona: { name: "Route Test", domain: "API Verification" } })
          })
        );
        const payload = (await initResponse.json()) as { agentId: string };
        createdAgentIds.push(payload.agentId);

        assert.equal(initResponse.status, 201);
        assert.ok(await getAgentById(payload.agentId));

        const feedResponse = await GET(
          new NextRequest(`http://localhost/api/agent/feed?agentId=${encodeURIComponent(payload.agentId)}`)
        );
        assert.equal(feedResponse.status, 200);
        assert.deepEqual(await feedResponse.json(), { posts: [] });
      });
    } finally {
      if (createdAgentIds.length > 0) {
        await pool.query("DELETE FROM agents WHERE id = ANY($1::text[])", [createdAgentIds]);
      }
      await pool.end();
    }
  });
}
