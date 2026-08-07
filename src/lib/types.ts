export type Source = {
  title: string;
  url: string;
  publishedAt: string | null;
};

export type FeedPost = {
  id: string;
  agentId: string;
  content: string;
  publishedAt: string;
  rationale: string;
  sources: Source[];
};
