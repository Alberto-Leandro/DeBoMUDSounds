import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    coverage: {
      reporter: ["text", "html"],
      include: ["src/parser/**/*.js", "src/runtime/**/*.js"],
    },
  },
});
