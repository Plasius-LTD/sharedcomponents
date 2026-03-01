import { defineConfig } from "vitest/config";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const localAnalyticsEntry = fileURLToPath(
  new URL("../analytics/src/index.ts", import.meta.url)
);

export default defineConfig({
  resolve: {
    alias: existsSync(localAnalyticsEntry)
      ? {
          "@plasius/analytics": localAnalyticsEntry,
        }
      : {},
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["tests/**/*.{test,tests}.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: ["**/node_modules/**", "dist", "dist-cjs", "**/types/**"],
    },
  },
});
