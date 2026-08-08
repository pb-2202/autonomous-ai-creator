import assert from "node:assert/strict";
import test from "node:test";
import { normalizeItem, normalizeUrl, stripHtml } from "../src/discovery/normalizer.ts";
import { parseFeed } from "../src/discovery/parser.ts";
import { discoverTopics } from "../src/discovery/service.ts";
import type { DiscoverySource } from "../src/discovery/types.ts";
import { createAgent, getRecentTopics } from "../src/lib/agents.ts";
import { database } from "../src/lib/db.ts";

const SAMPLE_RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Sample AI Blog</title>
    <link>https://example.com/blog</link>
    <item>
      <title><![CDATA[ Advancements in Open Source LLM Efficiency  ]]></title>
      <link>https://example.com/blog/llm-efficiency?utm_source=twitter&amp;utm_medium=social#top</link>
      <description><![CDATA[ <p>New benchmark results show <b>40% reduced latency</b> in quantization.</p> ]]></description>
      <pubDate>Fri, 07 Aug 2026 12:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Duplicate LLM Efficiency Title</title>
      <link>https://example.com/blog/llm-efficiency</link>
      <description>Duplicate description</description>
    </item>
  </channel>
</rss>`;

const SAMPLE_ATOM_XML = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>DeepMind Blog</title>
  <entry>
    <title>Breakthrough in Autonomous Agent Reasoning</title>
    <link href="https://example.com/research/agent-reasoning?ref=newsletter"/>
    <summary type="html">&lt;div&gt;Architectural insights into &lt;b&gt;multi-step planning&lt;/b&gt;.&lt;/div&gt;</summary>
    <published>2026-08-07T10:00:00Z</published>
  </entry>
</feed>`;

test("parseFeed parses RSS XML items correctly", () => {
  const items = parseFeed(SAMPLE_RSS_XML, "rss");
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "Advancements in Open Source LLM Efficiency");
  assert.ok(items[0].link.includes("llm-efficiency"));
  assert.ok(items[0].summary?.includes("40% reduced latency"));
});

test("parseFeed parses Atom XML entries correctly", () => {
  const items = parseFeed(SAMPLE_ATOM_XML, "atom");
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Breakthrough in Autonomous Agent Reasoning");
  assert.equal(items[0].link, "https://example.com/research/agent-reasoning?ref=newsletter");
});

test("parseFeed handles malformed or empty XML safely", () => {
  assert.deepEqual(parseFeed("", "rss"), []);
  assert.deepEqual(parseFeed("<invalid>xml", "rss"), []);
  assert.deepEqual(parseFeed("   ", "atom"), []);
});

test("stripHtml removes tags and cleans whitespace", () => {
  const dirty = "<div><p>Hello <b>World</b>!</p><style>body { color: red; }</style></div>";
  assert.equal(stripHtml(dirty), "Hello World!");
});

test("normalizeUrl converts host to lowercase and strips tracking params", () => {
  const raw = "HTTPS://Example.COM:443/news/article/?utm_source=rss&utm_medium=feed&ref=123#header";
  const normalized = normalizeUrl(raw);
  assert.equal(normalized, "https://example.com/news/article#header");
});

test("normalizeItem cleans titles, summaries, and computes SHA-256 fingerprint", () => {
  const source: DiscoverySource = { name: "Test Source", url: "https://example.com/feed", type: "rss", enabled: true };
  const rawItem = {
    title: "  New Model Release  ",
    summary: "<p>Summary with <i>HTML</i>.</p>",
    link: "https://example.com/release?utm_campaign=launch",
    pubDate: "2026-08-07T12:00:00Z"
  };

  const normalized = normalizeItem(rawItem, source);
  assert.ok(normalized);
  assert.equal(normalized?.title, "New Model Release");
  assert.equal(normalized?.summary, "Summary with HTML.");
  assert.equal(normalized?.sourceUrl, "https://example.com/release");
  assert.equal(normalized?.sourceName, "Test Source");
  assert.ok(normalized?.fingerprint.length === 64); // SHA-256 hex length
});

if (!process.env.DATABASE_URL) {
  test("discovery service DB integration", { skip: "DATABASE_URL is not configured" }, () => {});
} else {
  test("discovery service DB integration and deduplication", async (context) => {
    const pool = database();
    const createdAgentIds: string[] = [];

    try {
      await context.test("fetches, deduplicates, and persists topics from sources", async () => {
        const agent = await createAgent({ name: "Discovery Test", domain: "AI Web Search" });
        createdAgentIds.push(agent.id);

        const mockSources: DiscoverySource[] = [
          { name: "RSS Feed Source", url: "https://mock.example.com/rss", type: "rss", enabled: true },
          { name: "Atom Feed Source", url: "https://mock.example.com/atom", type: "atom", enabled: true },
          { name: "Failing Source", url: "https://mock.example.com/failing", type: "rss", enabled: true }
        ];

        const mockFetcher = async (url: string): Promise<string> => {
          if (url.includes("failing")) {
            throw new Error("Simulated network timeout");
          }
          if (url.includes("rss")) {
            return SAMPLE_RSS_XML;
          }
          return SAMPLE_ATOM_XML;
        };

        const result = await discoverTopics(agent, mockSources, mockFetcher);

        assert.equal(result.sourcesAttempted, 3);
        assert.equal(result.sourcesSucceeded, 2);
        assert.equal(result.sourcesFailed, 1);
        assert.equal(result.failedSources[0].name, "Failing Source");
        assert.ok(result.topicsPersisted >= 2);

        // Verify persisted topics in Postgres
        const dbTopics = await getRecentTopics(agent.id);
        assert.ok(dbTopics.length >= 2);
        assert.ok(dbTopics.some((t) => t.title.includes("Advancements in Open Source LLM")));

        // Running discovery a second time with same feeds should ignore all duplicates
        const secondRunResult = await discoverTopics(agent, mockSources, mockFetcher);
        assert.equal(secondRunResult.topicsPersisted, 0);
        assert.ok(secondRunResult.duplicatesIgnored >= 2);
      });
    } finally {
      if (createdAgentIds.length > 0) {
        await pool.query("DELETE FROM agents WHERE id = ANY($1::text[])", [createdAgentIds]);
      }
      await pool.end();
    }
  });
}
