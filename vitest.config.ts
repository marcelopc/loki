import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `layoutCommits`/`graphMetrics` are pure (no DOM, no browser APIs), so
    // run the lane-assignment tests in the fast node environment.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});