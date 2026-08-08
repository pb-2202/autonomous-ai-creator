import { randomUUID } from "node:crypto";

async function main(): Promise<void> {
  const providerName = (process.env.AI_PROVIDER || "mock").toLowerCase().trim();
  const provider = providerName === "groq" ? "groq" : "not-groq";
  const rawKey = process.env.GROQ_API_KEY || "";
  const model = (process.env.GROQ_MODEL || "llama-3.3-70b-versatile").trim();

  if (provider !== "groq") {
    console.error("Live Groq validation: AI_PROVIDER is not 'groq'. Current value:", providerName);
    throw new Error("AI_PROVIDER is not groq");
  }

  if (!rawKey || rawKey.trim().length === 0) {
    console.error("Live Groq validation: GROQ_API_KEY is not configured in the environment.");
    throw new Error("GROQ_API_KEY is not configured");
  }

  const apiKeys = rawKey
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (apiKeys.length === 0) {
    console.error("Live Groq validation: GROQ_API_KEY is configured, but no usable API key candidates were found.");
    throw new Error("No usable Groq API key candidates were found");
  }

  console.log(`Live Groq validation: provider=${provider}; model=${model}; key_present=${apiKeys.length > 0}; candidate_keys=${apiKeys.length}`);

  const body = {
    model,
    messages: [{ role: "user", content: "Return a JSON object with exactly: {\"ok\": true, \"check\": \"groq-structured\"}." }],
    temperature: 0.2,
    max_tokens: 128,
    response_format: { type: "json_object" }
  };

  let lastError: unknown = null;

  for (const apiKey of apiKeys) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      const responseText = await response.text();
      if (!response.ok) {
        const bodySnippet = responseText.slice(0, 300);
        console.error(`Live Groq validation: request failed status=${response.status}; provider_key_idx=${apiKeys.indexOf(apiKey) + 1}; body=${bodySnippet}`);
        lastError = new Error(`status=${response.status}; ${bodySnippet}`);
        continue;
      }

      const data = JSON.parse(responseText) as {
        choices?: Array<{
          message?: { content?: string };
        }>;
      };

      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        console.error("Live Groq validation: model returned empty or malformed structured output.");
        throw new Error("Malformed structured output returned by Groq");
      }

      const parsed = JSON.parse(content);
      if (parsed && parsed.ok === true && parsed.check === "groq-structured") {
        console.log(`Live Groq validation: SUCCESS provider=${provider} model=${model} structured_output_received=${content.length} bytes`);
        return;
      }

      console.error("Live Groq validation: malformed JSON payload was returned by the model.");
      throw new Error("Malformed JSON payload was returned by the model");
    } catch (error: unknown) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Live Groq validation: FAILURE provider=${provider} model=${model}; key_candidate=${apiKeys.indexOf(apiKey) + 1}; error=${message}`);
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  console.error(`Live Groq validation: FAILURE provider=${provider} model=${model}; error=${message}`);
  throw new Error(message);
}

try {
  await main();
} catch (error: unknown) {
  process.exitCode = 1;
}
