import { NextRequest, NextResponse } from "next/server";
import { getFeed } from "@/lib/agents";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get("agentId");

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required." }, { status: 400 });
  }

  try {
    const posts = await getFeed(agentId);
    return NextResponse.json({ posts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read the feed.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
