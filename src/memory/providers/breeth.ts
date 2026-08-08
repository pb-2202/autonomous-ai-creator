import type { MemoryProvider, MemorySyncResult, OutboxPayload } from "../types.ts";

export class BreethMemoryProvider implements MemoryProvider {
  readonly name = "breeth";
  private readonly apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.BREETH_API_KEY;
  }

  async syncMemory(payload: OutboxPayload): Promise<MemorySyncResult> {
    if (!this.apiKey || !this.apiKey.trim()) {
      return {
        success: false,
        error: "BREETH_API_KEY is not configured. Breeth API sync boundary inactive."
      };
    }

    // Breeth API integration boundary point for future API calls
    try {
      const response = await fetch("https://api.breeth.ai/v1/memory/sync", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Breeth API HTTP error ${response.status} ${response.statusText}`
        };
      }

      const data = (await response.json()) as { id?: string };
      return {
        success: true,
        remoteId: data.id || `breeth_remote_${payload.memoryId}`
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Network error during Breeth sync";
      return {
        success: false,
        error: errorMessage
      };
    }
  }
}
