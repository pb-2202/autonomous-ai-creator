import { NextResponse } from "next/server.js";
import { createAgent } from "../../../../lib/agents.ts";
import type { Persona } from "../../../../lib/types.ts";

export const runtime = "nodejs";

function readPersona(value: unknown): Persona | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const persona = (value as { persona?: unknown }).persona;
  if (!persona || typeof persona !== "object") {
    return null;
  }

  const { name, domain } = persona as { name?: unknown; domain?: unknown };
  if (typeof name !== "string" || typeof domain !== "string") {
    return null;
  }

  const normalizedName = name.trim();
  const normalizedDomain = domain.trim();
  if (!normalizedName || !normalizedDomain || normalizedName.length > 120 || normalizedDomain.length > 160) {
    return null;
  }

  return { name: normalizedName, domain: normalizedDomain };
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body. Expected a JSON persona with name and domain." },
      { status: 400 }
    );
  }

  const persona = readPersona(body);
  if (!persona) {
    return NextResponse.json(
      { error: "Invalid request body. Expected a JSON persona with name and domain." },
      { status: 400 }
    );
  }

  try {
    const agent = await createAgent(persona);
    return NextResponse.json({ agentId: agent.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "The service is temporarily unavailable." }, { status: 503 });
  }
}
