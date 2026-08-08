import type { DiscoverySource } from "./types.ts";

export const DEFAULT_DISCOVERY_SOURCES: DiscoverySource[] = [
  {
    name: "OpenAI News",
    url: "https://openai.com/news/rss.xml",
    type: "rss",
    enabled: true
  },
  {
    name: "Google DeepMind Blog",
    url: "https://deepmind.google/blog/feed/basic/",
    type: "atom",
    enabled: true
  },
  {
    name: "AWS Machine Learning Blog",
    url: "https://aws.amazon.com/blogs/machine-learning/feed/",
    type: "rss",
    enabled: true
  },
  {
    name: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    type: "rss",
    enabled: true
  }
];

export function getDiscoveryTimeoutMs(): number {
  const envVal = parseInt(process.env.DISCOVERY_TIMEOUT_MS || "", 10);
  return Number.isFinite(envVal) && envVal > 0 ? envVal : 8000;
}

export function getMaxItemsPerSource(): number {
  const envVal = parseInt(process.env.DISCOVERY_MAX_ITEMS_PER_SOURCE || "", 10);
  return Number.isFinite(envVal) && envVal > 0 ? envVal : 15;
}
