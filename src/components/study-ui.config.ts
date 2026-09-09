import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "study-ui.spec.ts",
  outputDir: "../../test-results/study-ui",
  workers: 1,
  reporter: "list",
});
