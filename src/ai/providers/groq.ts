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
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = (apiKey !== undefined ? apiKey : (process.env.GROQ_API_KEY || "")).trim();
    this.model = (model !== undefined ? model : (process.env.GROQ_MODEL || "llama-3.1-8b-instant")).trim();
  }

  private ensureApiKey(): void {
    if (!this.apiKey) {
      throw new Error(
        "GROQ_API_KEY is not configured in environment. Set GROQ_API_KEY or use AI_PROVIDER=mock."
      );
    }
  }

  async generateText(options: GenerateTextOptions): Promise<string> {
    this.ensureApiKey();
    await new Promise((res) => setTimeout(res, 500));

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
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
  }

  async generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<T> {
    this.ensureApiKey();
    await new Promise((res) => setTimeout(res, 500));

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
        Authorization: `Bearer ${this.apiKey}`,
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
  }
}
