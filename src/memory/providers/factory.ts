import type { MemoryProvider } from "../types.ts";
import { BreethMemoryProvider } from "./breeth.ts";
import { MockMemoryProvider } from "./mock.ts";

export function getMemoryProvider(): MemoryProvider {
  const providerType = (process.env.MEMORY_PROVIDER || "mock").toLowerCase().trim();

  if (providerType === "breeth") {
    return new BreethMemoryProvider();
  }

  return new MockMemoryProvider();
}
