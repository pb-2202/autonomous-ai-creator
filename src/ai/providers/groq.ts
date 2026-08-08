import type {
  GenerateStructuredOptions,
  GenerateTextOptions,
  LlmMessage,
  LlmProvider
} from "../types.ts";

function cleanJsonText(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    const lines = trimmed.split("\n");
    if (lines[0].startsWith("```")) lines.shift();
    if (lines[lines.length - 1].startsWith("```")) lines.pop();
    return lines.join("\n").trim();
  }
  return trimmed;
}

export class GroqLlmProvider implements LlmProvider {
  readonly name = "groq";
  private readonly apiKeys: string[];
  private readonly model: string;
  private currentKeyIndex = 0;

  constructor(apiKey?: string | string[], model?: string) {
    if (Array.isArray(apiKey)) {
      this.apiKeys = apiKey.map((k) => k.trim()).filter(Boolean);
    } else if (typeof apiKey === "string") {
      this.apiKeys = apiKey.split(",").map((k) => k.trim()).filter(Boolean);
    } else {
      const envKey = process.env.GROQ_API_KEY || "";
      this.apiKeys = envKey.split(",").map((k) => k.trim()).filter(Boolean);
    }

    this.model = (model !== undefined ? model : (process.env.GROQ_MODEL || "llama-3.1-8b-instant")).trim();
  }

  private ensureApiKeys(): string[] {
    if (this.apiKeys.length === 0) {
      throw new Error(
        "GROQ_API_KEY is not configured in environment. Set GROQ_API_KEY or use AI_PROVIDER=mock."
      );
    }
    return this.apiKeys;
  }

  private async executeWithKeyRotation<T>(
    requestFn: (apiKey: string) => Promise<T>
  ): Promise<T> {
    const keys = this.ensureApiKeys();
    let lastError: Error | null = null;

    const attempts = keys.length;
    for (let i = 0; i < attempts; i++) {
      const activeIndex = (this.currentKeyIndex + i) % keys.length;
      const activeKey = keys[activeIndex];

      try {
        const result = await requestFn(activeKey);
        this.currentKeyIndex = activeIndex; // Keep working key
        return result;
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        lastError = error;

        // Check if error is rate limit (429) or authentication/authorization failure
        const isRateLimitOrAuth =
          error.message.includes("429") ||
          error.message.includes("401") ||
          error.message.includes("403") ||
          error.message.includes("rate_limit_exceeded");

        if (isRateLimitOrAuth && keys.length > 1 && i < attempts - 1) {
          console.warn(
            `[GroqLlmProvider] Key ${activeIndex + 1}/${keys.length} hit rate limit / access error. Rotating to backup API key ${
              ((activeIndex + 1) % keys.length) + 1
            }...`
          );
          this.currentKeyIndex = (activeIndex + 1) % keys.length;
          // Small pause before retrying with next key
          await new Promise((res) => setTimeout(res, 300));
          continue;
        }

        // If error is not retryable or no other keys left, throw error
        throw error;
      }
    }

    throw lastError || new Error("All configured Groq API keys failed.");
  }

  async generateText(options: GenerateTextOptions): Promise<string> {
    return this.executeWithKeyRotation(async (apiKey) => {
      await new Promise((res) => setTimeout(res, 300));

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.model,
          messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens ?? 1000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API request failed (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };

      const text = data.choices?.[0]?.message?.content;
      if (typeof text !== "string" || !text.trim()) {
        throw new Error("Groq API returned empty or invalid response text.");
      }

      return text.trim();
    });
  }

  async generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<T> {
    return this.executeWithKeyRotation(async (apiKey) => {
      await new Promise((res) => setTimeout(res, 300));

      const messages: LlmMessage[] = options.messages.map((msg) =>
        msg.role === "system"
          ? {
              role: msg.role,
              content: `${msg.content}\n\nYou MUST format your output strictly as a JSON object matching this schema description:\n${options.schemaDescription}`
            }
          : msg
      );

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens ?? 1000,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API structured request failed (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };

      const text = data.choices?.[0]?.message?.content;
      if (typeof text !== "string" || !text.trim()) {
        throw new Error("Groq API returned empty or invalid structured response text.");
      }

      const cleanJson = cleanJsonText(text);
      return options.parse(cleanJson);
    });
  }
}
