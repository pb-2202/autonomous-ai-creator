import { AiService } from "../ai/service.ts";
import type { EditorialEvaluationResult } from "../ai/types.ts";
import { getSelectedTopicsForPublishing, savePublishedPost } from "../lib/agents.ts";
import { database } from "../lib/db.ts";
import type { Agent, FeedPost } from "../lib/types.ts";
import type { PublishingRunResult } from "./types.ts";

export type PublishSelectedTopicsOptions = {
  maxPostsPerCycle?: number;
  aiService?: AiService;
};

export async function publishSelectedTopics(
  agent: Agent,
  options?: PublishSelectedTopicsOptions
): Promise<PublishingRunResult> {
  const maxPosts = options?.maxPostsPerCycle ?? 1;
  const aiService = options?.aiService ?? new AiService(agent.persona);

  const candidates = await getSelectedTopicsForPublishing(agent.id, maxPosts);

  const result: PublishingRunResult = {
    candidateTopicsFound: candidates.length,
    postsGeneratedCount: 0,
    publishedPosts: [],
    failedCount: 0,
    failedTopics: []
  };

  const db = database();

  for (const topic of candidates) {
    try {
      // Query existing editorial decision reasoning for this topic
      const decisionRow = await db.query<{ reason: string; score: number | null }>(
        "SELECT reason, score FROM editorial_decisions WHERE topic_id = $1",
        [topic.id]
      );

      const evalResult: EditorialEvaluationResult = {
        decision: "selected",
        score: decisionRow.rows[0]?.score ?? 85,
        reason: decisionRow.rows[0]?.reason ?? "Top technical signal matching agent domain.",
        relevance: 9,
        novelty: 8,
        personaFit: 9
      };

      const postDraft = await aiService.draftPostForTopic(
        {
          title: topic.title,
          summary: topic.summary,
          sourceUrl: topic.sourceUrl
        },
        evalResult
      );

      // Ensure source URLs include topic's sourceUrl if not present
      const sourceUrls = [...postDraft.sources];
      if (topic.sourceUrl && !sourceUrls.includes(topic.sourceUrl)) {
        sourceUrls.unshift(topic.sourceUrl);
      }

      const publishedPost: FeedPost = await savePublishedPost({
        agentId: agent.id,
        topicId: topic.id,
        text: postDraft.text,
        rationale: postDraft.rationale,
        sourceUrls
      });

      result.postsGeneratedCount++;
      result.publishedPosts.push(publishedPost);
    } catch (error: unknown) {
      result.failedCount++;
      const errorMessage = error instanceof Error ? error.message : "Unknown post generation error";
      result.failedTopics.push({
        topicId: topic.id,
        title: topic.title,
        error: errorMessage
      });
      console.warn(
        `[Publishing] Failed to publish post for topic "${topic.title}" (${topic.id}): ${errorMessage}`
      );
    }
  }

  return result;
}
