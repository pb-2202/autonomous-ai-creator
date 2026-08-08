import type { Persona } from "../lib/types.ts";
import { buildPersona, formatPersonaSystemPrompt } from "./persona/builder.ts";
import { getLlmProvider } from "./providers/factory.ts";
import { parseEditorialDecision, parseGeneratedPost } from "./schemas/validators.ts";
import type {
  EditorialEvaluationResult,
  LlmMessage,
  LlmProvider,
  PersonaDefinition,
  PostGenerationResult
} from "./types.ts";

export type CandidateTopicInput = {
  title: string;
  summary?: string | null;
  sourceUrl?: string | null;
};

export class AiService {
  readonly persona: PersonaDefinition;
  readonly provider: LlmProvider;

  constructor(persona: Persona, provider?: LlmProvider) {
    this.persona = buildPersona(persona);
    this.provider = provider ?? getLlmProvider();
  }

  async generatePersonaGreeting(): Promise<string> {
    const systemPrompt = formatPersonaSystemPrompt(this.persona, "Persona Greeting & Readiness Check");
    const messages: LlmMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Provide a brief greeting statement detailing your active editorial domain and standards." }
    ];

    return this.provider.generateText({ messages, temperature: 0.3 });
  }

  async evaluateCandidateTopic(topic: CandidateTopicInput): Promise<EditorialEvaluationResult> {
    const systemPrompt = formatPersonaSystemPrompt(
      this.persona,
      "Candidate Topic Editorial Evaluation"
    );

    const userPrompt = `Evaluate the following candidate technology topic for potential publication.

Candidate Details:
- Title: ${topic.title}
- Summary: ${topic.summary || "N/A"}
- Source URL: ${topic.sourceUrl || "N/A"}

Evaluation Criteria:
1. Relevance to domain (${this.persona.domain}) and target audience.
2. Novelty and technical substance (Filter out market hype, speculative buzzwords, or superficial announcements).
3. Alignment with core editorial belief: "New does not automatically mean important."

You MUST return a JSON object with this exact shape:
{
  "decision": "selected" | "rejected",
  "score": number (0 to 100),
  "reason": "Detailed editorial rationale explaining why the topic was selected or rejected",
  "relevance": number (0 to 10),
  "novelty": number (0 to 10),
  "personaFit": number (0 to 10)
}`;

    const messages: LlmMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    return this.provider.generateStructured<EditorialEvaluationResult>({
      messages,
      schemaDescription: "JSON object containing 'decision' ('selected'|'rejected'), 'score' (0-100), 'reason', 'relevance', 'novelty', and 'personaFit'.",
      parse: parseEditorialDecision,
      temperature: 0.2
    });
  }

  async draftPostForTopic(
    topic: CandidateTopicInput,
    evaluation: EditorialEvaluationResult
  ): Promise<PostGenerationResult> {
    if (evaluation.decision !== "selected") {
      throw new Error("Cannot draft a post for a rejected editorial topic.");
    }

    const systemPrompt = formatPersonaSystemPrompt(
      this.persona,
      "Source-Grounded Post Drafting"
    );

    const fallbackSource = topic.sourceUrl || "https://tech-source.example.com";

    const userPrompt = `Draft a concise, source-grounded published post and rationale for an approved topic.

Approved Topic Details:
- Title: ${topic.title}
- Summary: ${topic.summary || "N/A"}
- Primary Source URL: ${fallbackSource}
- Editorial Evaluation Rationale: ${evaluation.reason}

Requirements:
- Post text must be concise (2 to 4 sentences), analytical, and adhere to tone: ${this.persona.writingStyle.join("; ")}
- Post rationale must state clearly why this item represents genuine technical signal worth reader attention.
- Must include at least 1 valid HTTP/HTTPS source URL (use the primary source URL above).

You MUST return a JSON object with this exact shape:
{
  "text": "Post narrative string",
  "rationale": "Clear editorial rationale string",
  "sources": ["${fallbackSource}"]
}`;

    const messages: LlmMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    return this.provider.generateStructured<PostGenerationResult>({
      messages,
      schemaDescription: "JSON object containing 'text', 'rationale', and 'sources' array.",
      parse: parseGeneratedPost,
      temperature: 0.3
    });
  }
}
