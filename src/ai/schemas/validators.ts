import type { EditorialEvaluationResult, PostGenerationResult } from "../types.ts";

function extractJsonBlock(rawText: string): string {
  const trimmed = rawText.trim();

  // Try extracting from markdown ```json ... ``` or ``` ... ```
  const jsonCodeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonCodeBlockMatch && jsonCodeBlockMatch[1]) {
    return jsonCodeBlockMatch[1].trim();
  }

  // Otherwise locate first '{' and last '}'
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function clampScore(val: unknown, min: number, max: number, defaultVal: number): number {
  if (typeof val === "number" && Number.isFinite(val)) {
    return Math.min(Math.max(val, min), max);
  }
  return defaultVal;
}

export function parseEditorialDecision(rawText: string): EditorialEvaluationResult {
  const jsonString = extractJsonBlock(rawText);
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`Failed to parse AI editorial decision JSON: ${(error as Error).message}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI editorial decision must be a JSON object.");
  }

  const obj = parsed as Record<string, unknown>;

  const rawDecision = String(obj.decision || "").toLowerCase().trim();
  const decision = rawDecision === "selected" ? "selected" : "rejected";

  const score = clampScore(obj.score, 0, 100, decision === "selected" ? 80 : 30);
  const relevance = clampScore(obj.relevance, 0, 10, Math.round(score / 10));
  const novelty = clampScore(obj.novelty, 0, 10, Math.round(score / 10));
  const personaFit = clampScore(obj.personaFit ?? obj.persona_fit, 0, 10, Math.round(score / 10));

  const reasonRaw = typeof obj.reason === "string" ? obj.reason.trim() : "";
  if (!reasonRaw) {
    throw new Error("AI editorial decision is missing a valid 'reason' string.");
  }

  return {
    decision,
    score,
    reason: reasonRaw,
    relevance,
    novelty,
    personaFit
  };
}

export function parseGeneratedPost(rawText: string): PostGenerationResult {
  const jsonString = extractJsonBlock(rawText);
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`Failed to parse AI generated post JSON: ${(error as Error).message}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI generated post must be a JSON object.");
  }

  const obj = parsed as Record<string, unknown>;

  const text = typeof obj.text === "string" ? obj.text.trim() : "";
  if (!text) {
    throw new Error("AI post generation is missing valid 'text' content.");
  }

  const rationale = typeof obj.rationale === "string" ? obj.rationale.trim() : "";
  if (!rationale) {
    throw new Error("AI post generation is missing valid 'rationale' content.");
  }

  const rawSources = Array.isArray(obj.sources) ? obj.sources : [];
  const validSources: string[] = [];

  for (const src of rawSources) {
    if (typeof src === "string" && src.trim()) {
      try {
        const url = new URL(src.trim());
        if (url.protocol === "http:" || url.protocol === "https:") {
          validSources.push(url.toString());
        }
      } catch {
        // Skip invalid URL
      }
    }
  }

  if (validSources.length === 0) {
    throw new Error("AI post generation must contain at least one valid HTTP/HTTPS source URL.");
  }

  return {
    text,
    rationale,
    sources: validSources
  };
}
