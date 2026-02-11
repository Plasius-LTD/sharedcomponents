import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["tests/**/*.{test,tests}.{ts,tsx}"],
    setupFiles: [],
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: ["**/node_modules/**", "dist", "dist-cjs", "**/types/**"],
    },
  },
});
