import { defineConfig } from "vitest/config";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const isElectronBuild = process.env.BUILD_TARGET === "electron";

const config = defineConfig({
  test: {
    teardownTimeout: 1000,
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "shared/**/*.{test,spec}.{ts,tsx}",
      "tests/**/*.{test,spec}.{ts,tsx}",
    ],
    globals: true,
    environment: "jsdom",
    setupFiles: ["@testing-library/jest-dom/vitest"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      shared: fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  plugins: [
    devtools(),
    nitro({
      rollupConfig: { external: [/^@sentry\//] },
      serverDir: "./server",
      ...(isElectronBuild ? { preset: "node-server" } : {}),
    }),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});

export default config;
