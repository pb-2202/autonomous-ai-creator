import type { EditorialDecision } from "../lib/types.ts";

export type EditorialRunResult = {
  evaluatedCount: number;
  selectedCount: number;
  rejectedCount: number;
  failedCount: number;
  decisions: EditorialDecision[];
  failedTopics: Array<{ topicId: string; title: string; error: string }>;
};
