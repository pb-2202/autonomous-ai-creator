import { NextRequest, NextResponse } from "next/server";
import { processNextJob } from "../../../../worker/index.ts";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Optional Vercel Cron Secret authorization check
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // If CRON_SECRET is configured in environment, enforce bearer auth
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const targetAgentId = searchParams.get("agentId") || undefined;

    const processed = await processNextJob(targetAgentId);

    return NextResponse.json(
      {
        success: true,
        processed,
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to execute worker tick.";
    console.error("[API /api/worker/tick] Execution failed:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
