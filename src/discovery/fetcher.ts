export async function fetchFeed(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "AutonomousAICreator/1.0 (ABTalks Vibe Code Hackathon)",
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    if (!text || !text.trim()) {
      throw new Error("Received empty response body from feed.");
    }

    return text;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Feed request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
