export type SourceType = "rss" | "atom";

export type DiscoverySource = {
  name: string;
  url: string;
  type: SourceType;
  enabled: boolean;
};

export type DiscoveredItem = {
  title: string;
  summary: string | null;
  link: string;
  pubDate: string | null;
};

export type NormalizedTopic = {
  title: string;
  summary: string | null;
  sourceUrl: string;
  sourceName: string;
  sourcePublishedAt: Date | null;
  fingerprint: string;
};

export type DiscoveryResult = {
  sourcesAttempted: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  topicsDiscovered: number;
  duplicatesIgnored: number;
  topicsPersisted: number;
  failedSources: Array<{ name: string; url: string; error: string }>;
};
