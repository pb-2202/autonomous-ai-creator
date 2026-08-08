import type {
  GenerateStructuredOptions,
  GenerateTextOptions,
  LlmProvider
} from "../types.ts";

export class MockLlmProvider implements LlmProvider {
  readonly name = "mock";

  async generateText(options: GenerateTextOptions): Promise<string> {
    const userMessage = options.messages.find((m) => m.role === "user")?.content || "";

    if (userMessage.toLowerCase().includes("greeting")) {
      return "Greetings. I am ready to evaluate technology developments with strict editorial criteria.";
    }

    return `[Mock AI Text Response] Processed ${options.messages.length} messages. Prompt snippet: "${userMessage.slice(0, 60)}..."`;
  }

  async generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<T> {
    const userMessage = options.messages.find((m) => m.role === "user")?.content || "";
    const lower = userMessage.toLowerCase();

    // Check if user prompt simulates a topic evaluation
    if (lower.includes("evaluate") || options.schemaDescription.toLowerCase().includes("editorial")) {
      const isWeakTopic =
        lower.includes("weak topic") ||
        lower.includes("rejection topic") ||
        lower.includes("low relevance") ||
        lower.includes("irrelevant") ||
        lower.includes("rumor") ||
        lower.includes("gadget") ||
        lower.includes("deals") ||
        lower.includes("discount") ||
        lower.includes("shopping") ||
        lower.includes("consumer app");

      const rawJson = isWeakTopic
        ? JSON.stringify({
            decision: "rejected",
            score: 25,
            reason: "Topic lacks technical novelty, exhibits low signal-to-noise ratio, or falls outside the agent's core domain.",
            relevance: 3,
            novelty: 2,
            personaFit: 3
          })
        : JSON.stringify({
            decision: "selected",
            score: 88,
            reason: "Presents verifiable architectural improvements in system efficiency and security controls.",
            relevance: 9,
            novelty: 8,
            personaFit: 9
          });

      return options.parse(rawJson);
    }

    // Check if user prompt simulates post generation
    if (lower.includes("draft") || lower.includes("post") || options.schemaDescription.toLowerCase().includes("post")) {
      const urlMatch = userMessage.match(/https?:\/\/[^\s"'\)]+/);
      const sourceUrl = urlMatch ? urlMatch[0] : "https://example.com/research/inference-benchmark";

      const rawJson = JSON.stringify({
        text: "New benchmark analysis demonstrates a 35% reduction in inference latency when using dynamic memory quantization. The results highlight practical efficiency gains over model parameter expansion.",
        rationale: "Selected because it provides empirical performance data rather than unverified claims.",
        sources: [sourceUrl]
      });

      return options.parse(rawJson);
    }

    // Default mock structured fallback
    const defaultJson = JSON.stringify({
      status: "mock_success",
      message: "Deterministic mock response"
    });

    return options.parse(defaultJson);
  }
}
