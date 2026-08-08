import type { FeedPost } from "../lib/types.ts";

export type PublishingRunResult = {
  candidateTopicsFound: number;
  postsGeneratedCount: number;
  publishedPosts: FeedPost[];
  failedCount: number;
  failedTopics: Array<{ topicId: string; title: string; error: string }>;
};
