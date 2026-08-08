import { spawnSync } from "node:child_process";

const testFiles = [
  "tests/persistence.test.ts",
  "tests/ai.test.ts",
  "tests/discovery.test.ts",
  "tests/editorial.test.ts",
  "tests/publishing.test.ts",
  "tests/memory.test.ts",
  "tests/evaluator_simulation.test.ts",
  "tests/openai_validation.test.ts",
  "tests/gemini_validation.test.ts",
  "tests/groq_validation.test.ts"
];

process.env.AI_PROVIDER = "mock";
process.env.MEMORY_PROVIDER = "mock";

const result = spawnSync(process.execPath, [
  "--env-file-if-exists=.env.local",
  "--experimental-strip-types",
  "--test",
  ...testFiles
], {
  stdio: "inherit",
  env: process.env
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
