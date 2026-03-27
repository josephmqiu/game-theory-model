/**
 * Separate Vitest config — avoids loading the Nitro plugin, which opens
 * file handles that prevent the test process from exiting.
 *
 * Vitest picks up vitest.config.ts before vite.config.ts automatically.
 */
import { configDefaults, defineConfig } from "vitest/config";
import viteTsConfigPaths from "vite-tsconfig-paths";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  // Disable Vite's file watcher — vitest run doesn't need it and the
  // watcher's file handles prevent the process from exiting
  server: {
    watch: null,
  },
  test: {
    teardownTimeout: 1000,
    // Restrict discovery to project source dirs — scanning .claude/worktrees/
    // creates file handles that prevent the process from exiting
    include: [
      "src/**/*.test.{ts,tsx}",
      "server/**/*.test.{ts,tsx}",
      "electron/**/*.test.{ts,tsx}",
      "shared/**/*.test.{ts,tsx}",
    ],
    server: {
      deps: {
        inline: ["react-markdown", "remark-gfm"],
      },
    },
    exclude: [
      ...configDefaults.exclude,
      "legacy/**",
      ".output/**",
      "dist/**",
      "electron-dist/**",
      "dist-electron/**",
      ".claude/**",
    ],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
  ],
});
