export type Persona = {
  name: string;
  domain: string;
};

export type Agent = {
  id: string;
  persona: Persona;
  active: boolean;
  initializedAt: string;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TopicStatus = "discovered" | "rejected" | "selected" | "published" | "failed";

export type DiscoveredTopic = {
  id: string;
  agentId: string;
  title: string;
  summary: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  sourcePublishedAt: string | null;
  discoveredAt: string;
  fingerprint: string;
  status: TopicStatus;
};

export type EditorialDecision = {
  topicId: string;
  decision: "rejected" | "selected";
  reason: string;
  score: number | null;
  decidedAt: string;
};

export type FeedPost = {
  id: string;
  createdAt: string;
  text: string;
  rationale: string;
  sources: string[];
};

export type AgentRunStatus = "running" | "succeeded" | "failed";

export type AgentRun = {
  id: string;
  agentId: string;
  status: AgentRunStatus;
  stage: string | null;
  selectedTopicId: string | null;
  publishedPostId: string | null;
  errorSummary: string | null;
  startedAt: string;
  finishedAt: string | null;
};
