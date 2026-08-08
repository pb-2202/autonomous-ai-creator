import type {
  GenerateStructuredOptions,
  GenerateTextOptions,
  LlmProvider
} from "../types.ts";

export class OpenAiLlmProvider implements LlmProvider {
  readonly name = "openai";
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = (apiKey || process.env.OPENAI_API_KEY || "").trim();
    this.model = (model || process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
  }

  private ensureApiKey(): void {
    if (!this.apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not configured in environment. Set OPENAI_API_KEY or use AI_PROVIDER=mock."
      );
    }
  }

  async generateText(options: GenerateTextOptions): Promise<string> {
    this.ensureApiKey();

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 1000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API request failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("OpenAI API returned empty or invalid response content.");
    }

    return content;
  }

  async generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<T> {
    this.ensureApiKey();

    const systemPromptModifier = `You must return your output strictly as a JSON object matching the following format description:
${options.schemaDescription}
Do not include any conversational commentary outside the JSON block.`;

    const messages = options.messages.map((msg) =>
      msg.role === "system"
        ? { role: msg.role, content: `${msg.content}\n\n${systemPromptModifier}` }
        : msg
    );

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        response_format: { type: "json_object" },
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 1000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API structured request failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("OpenAI API returned empty or invalid response content for structured output.");
    }

    return options.parse(content);
  }
}
