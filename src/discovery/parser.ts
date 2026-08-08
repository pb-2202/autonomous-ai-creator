import type { DiscoveredItem, SourceType } from "./types.ts";

function unescapeXml(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&");
}

function cleanCdata(text: string): string {
  let cleaned = text;
  // Unwrap CDATA blocks if present
  cleaned = cleaned.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1");
  return unescapeXml(cleaned).trim();
}

function extractFirstTag(xml: string, tags: string[]): string | null {
  for (const tag of tags) {
    // Escaped tag name for regex safely
    const escapedTag = tag.replace(":", "\\:");
    const regex = new RegExp(`<${escapedTag}[^>]*>([\\s\\S]*?)</${escapedTag}>`, "i");
    const match = regex.exec(xml);
    if (match && match[1]) {
      const val = cleanCdata(match[1]);
      if (val) return val;
    }
  }
  return null;
}

export function parseFeed(xml: string, sourceType: SourceType): DiscoveredItem[] {
  const items: DiscoveredItem[] = [];
  if (!xml || typeof xml !== "string") {
    return items;
  }

  // Identify <item> or <entry> blocks
  const blockRegex = /<(item|entry)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(xml)) !== null) {
    const itemXml = match[2];

    const title = extractFirstTag(itemXml, ["title"]) || "";

    // Extract link
    let link = extractFirstTag(itemXml, ["link"]) || "";

    // If Atom <link href="..." /> format was used
    if (!link) {
      const hrefMatch = /<link[^>]+href=["']([^"']+)["']/i.exec(itemXml);
      if (hrefMatch && hrefMatch[1]) {
        link = cleanCdata(hrefMatch[1]);
      }
    }

    // Extract summary/description
    const summary = extractFirstTag(itemXml, [
      "content:encoded",
      "content",
      "summary",
      "description"
    ]);

    // Extract date
    const pubDate = extractFirstTag(itemXml, [
      "pubDate",
      "published",
      "updated",
      "dc:date"
    ]);

    if (title && link) {
      items.push({
        title,
        summary,
        link,
        pubDate
      });
    }
  }

  return items;
}
