import assert from "node:assert/strict";
import test from "node:test";
import { buildPersona, formatPersonaSystemPrompt } from "../src/ai/persona/builder.ts";
import { getLlmProvider } from "../src/ai/providers/factory.ts";
import { MockLlmProvider } from "../src/ai/providers/mock.ts";
import { OpenAiLlmProvider } from "../src/ai/providers/openai.ts";
import { parseEditorialDecision, parseGeneratedPost } from "../src/ai/schemas/validators.ts";
import { AiService } from "../src/ai/service.ts";

test("buildPersona expands name and domain into rich persona definition", () => {
  const personaDef = buildPersona({ name: "Ada", domain: "AI Security" });

  assert.equal(personaDef.name, "Ada");
  assert.equal(personaDef.domain, "AI Security");
  assert.ok(personaDef.interests.some((i) => i.toLowerCase().includes("vulnerability")));
  assert.ok(personaDef.editorialBeliefs.some((b) => b.includes("New does not automatically mean important")));
});

test("formatPersonaSystemPrompt formats instructions with persona identity and task context", () => {
  const personaDef = buildPersona({ name: "Ada", domain: "AI Security" });
  const prompt = formatPersonaSystemPrompt(personaDef, "Topic Evaluation");

  assert.ok(prompt.includes("You are Ada"));
  assert.ok(prompt.includes("AI Security"));
  assert.ok(prompt.includes("CURRENT TASK: Topic Evaluation"));
});

test("parseEditorialDecision validates raw JSON and extracts scores", () => {
  const validJson = `\`\`\`json
  {
    "decision": "selected",
    "score": 95,
    "reason": "Strong empirical security evidence.",
    "relevance": 9,
    "novelty": 8,
    "personaFit": 10
  }
  \`\`\``;

  const result = parseEditorialDecision(validJson);
  assert.equal(result.decision, "selected");
  assert.equal(result.score, 95);
  assert.equal(result.reason, "Strong empirical security evidence.");
  assert.equal(result.relevance, 9);
});

test("parseEditorialDecision rejects missing reason string", () => {
  const invalidJson = `{"decision": "selected", "score": 95}`;
  assert.throws(() => parseEditorialDecision(invalidJson), /missing a valid 'reason'/);
});

test("parseGeneratedPost validates post content and source URLs", () => {
  const validJson = JSON.stringify({
    text: "Analysis shows 35% performance gain.",
    rationale: "Selected for technical data.",
    sources: ["https://example.com/source1"]
  });

  const result = parseGeneratedPost(validJson);
  assert.equal(result.text, "Analysis shows 35% performance gain.");
  assert.deepEqual(result.sources, ["https://example.com/source1"]);
});

test("parseGeneratedPost rejects missing HTTP source URL", () => {
  const invalidJson = JSON.stringify({
    text: "Valid text content.",
    rationale: "Valid rationale.",
    sources: ["invalid-url"]
  });

  assert.throws(() => parseGeneratedPost(invalidJson), /at least one valid HTTP\/HTTPS source URL/);
});

test("MockLlmProvider produces deterministic text and structured responses", async () => {
  const provider = new MockLlmProvider();

  const text = await provider.generateText({
    messages: [{ role: "user", content: "greeting check" }]
  });
  assert.ok(text.includes("Greetings"));

  const evalResult = await provider.generateStructured({
    messages: [{ role: "user", content: "evaluate strong technical topic" }],
    schemaDescription: "editorial decision",
    parse: parseEditorialDecision
  });
  assert.equal(evalResult.decision, "selected");
  assert.ok(evalResult.score >= 80);
});

test("OpenAiLlmProvider throws when API key is missing", async () => {
  const provider = new OpenAiLlmProvider("");

  await assert.rejects(
    () => provider.generateText({ messages: [{ role: "user", content: "test" }] }),
    /OPENAI_API_KEY is not configured/
  );
});

test("getLlmProvider returns MockLlmProvider by default", () => {
  const provider = getLlmProvider("mock");
  assert.equal(provider.name, "mock");
});

test("AiService evaluates candidate topics and drafts posts using persona policy", async () => {
  const aiService = new AiService(
    { name: "Ada", domain: "AI Security" },
    new MockLlmProvider()
  );

  const evaluation = await aiService.evaluateCandidateTopic({
    title: "Critical vulnerability discovered in model weights",
    sourceUrl: "https://example.com/advisory"
  });
  assert.equal(evaluation.decision, "selected");
  assert.ok(evaluation.score > 70);

  const post = await aiService.draftPostForTopic(
    { title: "Critical vulnerability discovered in model weights", sourceUrl: "https://example.com/advisory" },
    evaluation
  );
  assert.ok(post.text.length > 10);
  assert.ok(post.sources.includes("https://example.com/advisory"));
});
