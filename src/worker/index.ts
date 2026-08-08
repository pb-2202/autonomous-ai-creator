import { randomUUID } from "node:crypto";
import {
  claimDueAgentJob,
  completeAgentRunFailure,
  completeAgentRunSuccess,
  recoverStaleAgentLocks
} from "../lib/agents.ts";
import type { Agent, AgentRun } from "../lib/types.ts";

const WORKER_ID = `worker_${randomUUID()}`;
const RUN_INTERVAL_SECONDS = parseInt(process.env.AGENT_RUN_INTERVAL_SECONDS || "300", 10);
const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS || "5000", 10);
const STALE_LOCK_TIMEOUT_MS = parseInt(process.env.WORKER_STALE_LOCK_TIMEOUT_MS || "300000", 10);
const SINGLE_RUN_MODE = process.env.WORKER_SINGLE_RUN === "true";

let isShuttingDown = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type CyclePipelineContext = {
  agent: Agent;
  run: AgentRun;
};

/**
 * Modular autonomous execution pipeline scaffold.
 * Future phases will replace placeholders with real AI & discovery operations.
 */
export async function runAgentCycle(context: CyclePipelineContext): Promise<{ stage: string }> {
  const { agent } = context;

  // Step 1: Discover topics (Placeholder for Phase 5)
  // Step 2: Evaluate topics (Placeholder for Phase 6)
  // Step 3: Select top topic (Placeholder for Phase 6)
  // Step 4: Generate post text & rationale (Placeholder for Phase 7)
  // Step 5: Check memory / Breeth sync (Placeholder for Phase 8)
  // Step 6: Publish post and sources (Placeholder for Phase 7)

  console.info(`[Worker ${WORKER_ID}] Autonomous cycle reached for agent "${agent.persona.name}" (${agent.id}).`);
  return { stage: "complete" };
}

export async function processNextJob(targetAgentId?: string): Promise<boolean> {
  let claimed: { agent: Agent; run: AgentRun } | null = null;

  try {
    await recoverStaleAgentLocks(STALE_LOCK_TIMEOUT_MS);
    claimed = await claimDueAgentJob(WORKER_ID, STALE_LOCK_TIMEOUT_MS, targetAgentId);

    if (!claimed) {
      return false;
    }

    const { agent, run } = claimed;
    console.info(`[Worker ${WORKER_ID}] Claimed job for agent ${agent.id} (run ${run.id}).`);

    try {
      const result = await runAgentCycle({ agent, run });
      await completeAgentRunSuccess(agent.id, run.id, RUN_INTERVAL_SECONDS, result.stage);
      console.info(`[Worker ${WORKER_ID}] Run ${run.id} succeeded for agent ${agent.id}.`);
    } catch (cycleError) {
      const errorMessage = cycleError instanceof Error ? cycleError.message : "Unknown cycle error.";
      console.error(`[Worker ${WORKER_ID}] Run ${run.id} failed for agent ${agent.id}: ${errorMessage}`);
      await completeAgentRunFailure(agent.id, run.id, "cycle_execution", errorMessage, RUN_INTERVAL_SECONDS);
    }

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Database error in worker loop.";
    console.error(`[Worker ${WORKER_ID}] Error claiming/processing job: ${errorMessage}`);
    return false;
  }
}

export async function startWorkerLoop(): Promise<void> {
  console.info(
    `[Worker ${WORKER_ID}] Started worker loop. Cadence: ${RUN_INTERVAL_SECONDS}s, Poll: ${POLL_INTERVAL_MS}ms.`
  );

  const shutdownHandler = () => {
    if (!isShuttingDown) {
      console.info(`[Worker ${WORKER_ID}] Shutdown signal received. Stopping worker loop...`);
      isShuttingDown = true;
    }
  };

  process.on("SIGINT", shutdownHandler);
  process.on("SIGTERM", shutdownHandler);

  while (!isShuttingDown) {
    const processed = await processNextJob();

    if (SINGLE_RUN_MODE) {
      console.info(`[Worker ${WORKER_ID}] Single-run mode complete. Exiting worker.`);
      break;
    }

    if (!processed && !isShuttingDown) {
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

// Automatically start worker loop if invoked directly from CLI
if (process.argv[1]?.endsWith("worker/index.ts") || process.argv[1]?.endsWith("worker/index.js")) {
  startWorkerLoop().catch((error) => {
    console.error(`[Worker ${WORKER_ID}] Fatal error:`, error);
    process.exitCode = 1;
  });
}

