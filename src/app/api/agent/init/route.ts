import { NextResponse } from "next/server";
import { initializeAgent } from "@/lib/agents";

export const runtime = "nodejs";

export async function POST() {
  try {
    const agent = await initializeAgent();
    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to initialize the agent.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
