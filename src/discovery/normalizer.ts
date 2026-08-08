import { createHash } from "node:crypto";
import type { DiscoveredItem, DiscoverySource, NormalizedTopic } from "./types.ts";

export function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<(p|div|br|li|h[1-6]|tr|td|blockquote)[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    // Lowercase hostname
    parsed.hostname = parsed.hostname.toLowerCase();

    // Strip common tracking query parameters
    const paramsToStrip = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid",
      "ref"
    ];

    for (const param of paramsToStrip) {
      parsed.searchParams.delete(param);
    }

    // Standardize path (strip trailing slash if not root)
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return parsed.toString();
  } catch {
    return "";
  }
}

export function computeTopicFingerprint(title: string, sourceUrl: string): string {
  const normalizedTitle = title.trim().toLowerCase();
  const normalizedUrl = sourceUrl.trim().toLowerCase();
  return createHash("sha256")
    .update(`${normalizedTitle}\n${normalizedUrl}`)
    .digest("hex");
}

export function normalizeItem(
  item: DiscoveredItem,
  source: DiscoverySource
): NormalizedTopic | null {
  const title = item.title.trim().replace(/\s+/g, " ");
  if (!title || title.length < 3) {
    return null;
  }

  const sourceUrl = normalizeUrl(item.link);
  if (!sourceUrl) {
    return null;
  }

  let summary: string | null = null;
  if (item.summary) {
    const cleaned = stripHtml(item.summary);
    if (cleaned.length > 0) {
      summary = cleaned.slice(0, 2000);
    }
  }

  let sourcePublishedAt: Date | null = null;
  if (item.pubDate) {
    const timestamp = Date.parse(item.pubDate);
    if (!isNaN(timestamp)) {
      sourcePublishedAt = new Date(timestamp);
    }
  }

  const fingerprint = computeTopicFingerprint(title, sourceUrl);

  return {
    title,
    summary,
    sourceUrl,
    sourceName: source.name,
    sourcePublishedAt,
    fingerprint
  };
}
