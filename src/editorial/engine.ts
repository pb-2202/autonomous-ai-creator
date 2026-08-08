import { AiService } from "../ai/service.ts";
import { getPendingDiscoveredTopics, saveEditorialDecision } from "../lib/agents.ts";
import type { Agent, EditorialDecision } from "../lib/types.ts";
import { getRecentAgentMemories } from "../memory/repository.ts";
import type { EditorialRunResult } from "./types.ts";

export type EvaluatePendingTopicsOptions = {
  limit?: number;
  aiService?: AiService;
};

export async function evaluatePendingTopics(
  agent: Agent,
  options?: EvaluatePendingTopicsOptions
): Promise<EditorialRunResult> {
  const limit = options?.limit ?? 20;
  const aiService = options?.aiService ?? new AiService(agent.persona);

  const pendingTopics = await getPendingDiscoveredTopics(agent.id, limit);
  const recentMemories = await getRecentAgentMemories(agent.id, 10);

  const result: EditorialRunResult = {
    evaluatedCount: 0,
    selectedCount: 0,
    rejectedCount: 0,
    failedCount: 0,
    decisions: [],
    failedTopics: []
  };

  for (const topic of pendingTopics) {
    try {
      const evaluation = await aiService.evaluateCandidateTopic(
        {
          title: topic.title,
          summary: topic.summary,
          sourceUrl: topic.sourceUrl
        },
        recentMemories
      );

      const decision: EditorialDecision = await saveEditorialDecision({
        topicId: topic.id,
        decision: evaluation.decision,
        reason: evaluation.reason,
        score: evaluation.score
      });

      result.evaluatedCount++;
      if (decision.decision === "selected") {
        result.selectedCount++;
      } else {
        result.rejectedCount++;
      }
      result.decisions.push(decision);
    } catch (error: unknown) {
      result.failedCount++;
      const errorMessage = error instanceof Error ? error.message : "Unknown evaluation error";
      result.failedTopics.push({
        topicId: topic.id,
        title: topic.title,
        error: errorMessage
      });
      console.warn(
        `[Editorial] Failed to evaluate topic "${topic.title}" (${topic.id}): ${errorMessage}`
      );
    }
  }

  return result;
}
