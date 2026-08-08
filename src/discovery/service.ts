import { getRecentTopics, saveDiscoveredTopic } from "../lib/agents.ts";
import type { Agent } from "../lib/types.ts";
import {
  DEFAULT_DISCOVERY_SOURCES,
  getDiscoveryTimeoutMs,
  getMaxItemsPerSource
} from "./config.ts";
import { fetchFeed } from "./fetcher.ts";
import { normalizeItem } from "./normalizer.ts";
import { parseFeed } from "./parser.ts";
import type { DiscoveryResult, DiscoverySource, NormalizedTopic } from "./types.ts";

export async function discoverTopics(
  agent: Agent,
  customSources?: DiscoverySource[],
  customFetcher?: (url: string, timeoutMs: number) => Promise<string>
): Promise<DiscoveryResult> {
  const sources = (customSources || DEFAULT_DISCOVERY_SOURCES).filter((s) => s.enabled);
  const timeoutMs = getDiscoveryTimeoutMs();
  const maxItems = getMaxItemsPerSource();
  const fetcher = customFetcher || fetchFeed;

  const result: DiscoveryResult = {
    sourcesAttempted: sources.length,
    sourcesSucceeded: 0,
    sourcesFailed: 0,
    topicsDiscovered: 0,
    duplicatesIgnored: 0,
    topicsPersisted: 0,
    failedSources: []
  };

  // Fetch recent topics from DB for this agent to check for existing fingerprints
  const existingTopics = await getRecentTopics(agent.id, 100);
  const knownFingerprints = new Set<string>(existingTopics.map((t) => t.fingerprint));

  const allNormalizedTopics: NormalizedTopic[] = [];
  const runFingerprints = new Set<string>();

  for (const source of sources) {
    try {
      const xml = await fetcher(source.url, timeoutMs);
      const rawItems = parseFeed(xml, source.type).slice(0, maxItems);
      result.sourcesSucceeded++;

      for (const item of rawItems) {
        const normalized = normalizeItem(item, source);
        if (!normalized) {
          continue;
        }

        result.topicsDiscovered++;

        // Deduplicate locally within the current run and against DB
        if (runFingerprints.has(normalized.fingerprint) || knownFingerprints.has(normalized.fingerprint)) {
          result.duplicatesIgnored++;
          continue;
        }

        runFingerprints.add(normalized.fingerprint);
        allNormalizedTopics.push(normalized);
      }
    } catch (error: unknown) {
      result.sourcesFailed++;
      const errorMessage = error instanceof Error ? error.message : "Unknown fetch/parse error";
      result.failedSources.push({
        name: source.name,
        url: source.url,
        error: errorMessage
      });
      console.warn(`[Discovery] Source "${source.name}" (${source.url}) failed: ${errorMessage}`);
    }
  }

  // Persist new unique topics to PostgreSQL
  for (const topic of allNormalizedTopics) {
    try {
      await saveDiscoveredTopic({
        agentId: agent.id,
        title: topic.title,
        summary: topic.summary,
        sourceUrl: topic.sourceUrl,
        sourceName: topic.sourceName,
        sourcePublishedAt: topic.sourcePublishedAt,
        fingerprint: topic.fingerprint,
        status: "discovered"
      });
      result.topicsPersisted++;
      knownFingerprints.add(topic.fingerprint);
    } catch (persistError) {
      console.error(`[Discovery] Failed to persist topic "${topic.title}":`, persistError);
    }
  }

  return result;
}
