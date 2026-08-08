export type MemorySyncStatus = "pending" | "processing" | "synced" | "failed";

export type AgentMemory = {
  id: string;
  agentId: string;
  postId: string;
  topicTitle: string;
  summary: string | null;
  postText: string;
  rationale: string;
  sourceUrls: string[];
  fingerprint: string;
  publishedAt: string;
  syncStatus: MemorySyncStatus;
  createdAt: string;
};

export type OutboxPayload = {
  memoryId: string;
  agentId: string;
  postId: string;
  topicTitle: string;
  postText: string;
  rationale: string;
  sourceUrls: string[];
  publishedAt: string;
};

export type MemoryOutboxRecord = {
  id: string;
  agentId: string;
  memoryId: string;
  payload: OutboxPayload;
  status: MemorySyncStatus;
  attempts: number;
  lastAttemptAt: string | null;
  syncedAt: string | null;
  lastError: string | null;
  createdAt: string;
};

export type MemorySyncResult = {
  success: boolean;
  remoteId?: string;
  error?: string;
};

export interface MemoryProvider {
  readonly name: string;
  syncMemory(payload: OutboxPayload): Promise<MemorySyncResult>;
}
