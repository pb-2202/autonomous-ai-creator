import type { LlmProvider } from "../types.ts";
import { GeminiLlmProvider } from "./gemini.ts";
import { GroqLlmProvider } from "./groq.ts";
import { MockLlmProvider } from "./mock.ts";
import { OpenAiLlmProvider } from "./openai.ts";

export function getLlmProvider(overrideProviderName?: string): LlmProvider {
  const providerName = (overrideProviderName || process.env.AI_PROVIDER || "mock").toLowerCase().trim();

  if (providerName === "groq") {
    return new GroqLlmProvider();
  }

  if (providerName === "gemini") {
    return new GeminiLlmProvider();
  }

  if (providerName === "openai") {
    return new OpenAiLlmProvider();
  }

  return new MockLlmProvider();
}
