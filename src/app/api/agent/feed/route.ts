import { NextRequest, NextResponse } from "next/server.js";
import { getAgentById, getPublishedPosts } from "../../../../lib/agents.ts";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get("agentId")?.trim();

  if (!agentId || agentId.length > 100) {
    return NextResponse.json({ error: "agentId is required." }, { status: 400 });
  }

  try {
    const agent = await getAgentById(agentId);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }

    const posts = await getPublishedPosts(agentId);
    return NextResponse.json({ posts });
  } catch {
    return NextResponse.json({ error: "The service is temporarily unavailable." }, { status: 503 });
  }
}
