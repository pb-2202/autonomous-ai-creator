import { randomUUID } from "crypto";

export function createId(prefix: "agent" | "topic" | "post" | "run"): string {
  return `${prefix}_${randomUUID()}`;
}
