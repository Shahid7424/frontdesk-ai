import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname),
      // Next enforces server-only at build time; in tests it's just a marker.
      "server-only": resolve(__dirname, "test/server-only.ts"),
    },
  },
  test: { include: ["test/**/*.test.ts"] },
});
