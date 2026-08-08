import { getMemoryProvider } from "./providers/factory.ts";
import { getPendingOutboxRecords, updateOutboxRecord } from "./repository.ts";
import type { MemoryProvider } from "./types.ts";

export type SyncOutboxResult = {
  attemptedCount: number;
  syncedCount: number;
  failedCount: number;
};

export async function syncAgentOutbox(
  agentId: string,
  customProvider?: MemoryProvider
): Promise<SyncOutboxResult> {
  const provider = customProvider || getMemoryProvider();
  const records = await getPendingOutboxRecords(agentId, 10);

  const result: SyncOutboxResult = {
    attemptedCount: records.length,
    syncedCount: 0,
    failedCount: 0
  };

  for (const record of records) {
    try {
      const syncRes = await provider.syncMemory(record.payload);

      if (syncRes.success) {
        await updateOutboxRecord(record.id, record.memoryId, "synced");
        result.syncedCount++;
      } else {
        await updateOutboxRecord(record.id, record.memoryId, "failed", syncRes.error);
        result.failedCount++;
      }
    } catch (error: unknown) {
      result.failedCount++;
      const errorMessage = error instanceof Error ? error.message : "Outbox sync error";
      try {
        await updateOutboxRecord(record.id, record.memoryId, "failed", errorMessage);
      } catch (dbError) {
        console.error(`[MemorySync] DB update error for outbox record ${record.id}:`, dbError);
      }
    }
  }

  return result;
}
