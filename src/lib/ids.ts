import { randomUUID } from "crypto";

export function createId(prefix: "agent" | "job" | "post"): string {
  return `${prefix}_${randomUUID()}`;
}
