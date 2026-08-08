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

export class GeminiLlmProvider implements LlmProvider {
  readonly name = "gemini";
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = (apiKey || process.env.GEMINI_API_KEY || "").trim();
    this.model = (model || process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();
  }

  private ensureApiKey(): void {
    if (!this.apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not configured in environment. Set GEMINI_API_KEY or use AI_PROVIDER=mock."
      );
    }
  }

  private buildGeminiPayload(messages: LlmMessage[], isJsonMode = false) {
    const systemParts: string[] = [];
    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemParts.push(msg.content);
      } else {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }]
        });
      }
    }

    // Ensure at least one user message exists
    if (contents.length === 0) {
      contents.push({
        role: "user",
        parts: [{ text: "Process request according to instructions." }]
      });
    }

    const payload: {
      contents: typeof contents;
      systemInstruction?: { parts: Array<{ text: string }> };
      generationConfig?: Record<string, unknown>;
    } = {
      contents
    };

    if (systemParts.length > 0) {
      payload.systemInstruction = {
        parts: [{ text: systemParts.join("\n\n") }]
      };
    }

    if (isJsonMode) {
      payload.generationConfig = {
        responseMimeType: "application/json"
      };
    }

    return payload;
  }

  async generateText(options: GenerateTextOptions): Promise<string> {
    this.ensureApiKey();

    const payload = this.buildGeminiPayload(options.messages, false);
    if (options.temperature !== undefined || options.maxTokens !== undefined) {
      payload.generationConfig = {
        ...(payload.generationConfig || {}),
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        ...(options.maxTokens !== undefined ? { maxOutputTokens: options.maxTokens } : {})
      };
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.model
    )}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API request failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("Gemini API returned empty or invalid response text.");
    }

    return text.trim();
  }

  async generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<T> {
    this.ensureApiKey();

    const messages = options.messages.map((msg) =>
      msg.role === "system"
        ? {
            role: msg.role,
            content: `${msg.content}\n\nYou MUST format your output strictly as a JSON object matching this schema description:\n${options.schemaDescription}`
          }
        : msg
    );

    const payload = this.buildGeminiPayload(messages, true);
    payload.generationConfig = {
      ...(payload.generationConfig || {}),
      responseMimeType: "application/json",
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.maxTokens !== undefined ? { maxOutputTokens: options.maxTokens } : {})
    };

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.model
    )}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API structured request failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("Gemini API returned empty or invalid structured response text.");
    }

    const cleanJson = cleanJsonText(text);
    return options.parse(cleanJson);
  }
}
