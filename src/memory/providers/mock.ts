import type { MemoryProvider, MemorySyncResult, OutboxPayload } from "../types.ts";

export class MockMemoryProvider implements MemoryProvider {
  readonly name = "mock";

  async syncMemory(payload: OutboxPayload): Promise<MemorySyncResult> {
    if (payload.topicTitle.toLowerCase().includes("fail sync")) {
      return {
        success: false,
        error: "Simulated Breeth memory sync timeout"
      };
    }

    return {
      success: true,
      remoteId: `breeth_mock_${payload.memoryId}`
    };
  }
}
