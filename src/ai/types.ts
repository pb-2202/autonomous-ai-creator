import type { Persona } from "../lib/types.ts";

export type PersonaDefinition = {
  name: string;
  domain: string;
  tagline: string;
  mission: string;
  interests: string[];
  avoidedTopics: string[];
  editorialBeliefs: string[];
  writingStyle: string[];
  audience: string;
  publishingStandards: string[];
};

export type LlmRole = "system" | "user" | "assistant";

export type LlmMessage = {
  role: LlmRole;
  content: string;
};

export type GenerateTextOptions = {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type GenerateStructuredOptions<T> = {
  messages: LlmMessage[];
  schemaDescription: string;
  parse: (rawText: string) => T;
  temperature?: number;
  maxTokens?: number;
};

export type EditorialDecisionType = "selected" | "rejected";

export type EditorialEvaluationResult = {
  decision: EditorialDecisionType;
  score: number; // 0 to 100
  reason: string;
  relevance: number; // 0 to 10
  novelty: number; // 0 to 10
  personaFit: number; // 0 to 10
};

export type PostGenerationResult = {
  text: string;
  rationale: string;
  sources: string[];
};

export interface LlmProvider {
  readonly name: string;
  generateText(options: GenerateTextOptions): Promise<string>;
  generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<T>;
}
