import { defineConfig } from "vite";
import type { PluginOption } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";

const isElectronBuild = process.env.BUILD_TARGET === "electron";
const isVitest = process.env.VITEST === "true";
const tanstackDevtoolsEventBusEnabled =
  process.env.TANSTACK_DEVTOOLS_EVENT_BUS === "true";
const tanstackDevtoolsEventBusPort = process.env
  .TANSTACK_DEVTOOLS_EVENT_BUS_PORT
  ? Number.parseInt(process.env.TANSTACK_DEVTOOLS_EVENT_BUS_PORT, 10)
  : undefined;

// Nitro opens file handles that prevent Vitest from exiting.
// Dynamic import avoids loading the module during tests.
//
// NOTE: Pinned to nitro-nightly because the Nitro 3.0.0 stable release has a
// different vite plugin API (NitroPluginConfig.config vs direct options) and
// removes the `features`, `node`, `serverDir` config surface this app depends on.
// Migration to stable requires a dedicated compatibility spike. See TODOS.md P2.
let nitroPlugins: PluginOption | undefined;
if (!isVitest) {
  const { nitro } = await import("nitro/vite");
  nitroPlugins = nitro({
    features: { websocket: true },
    node: true,
    rollupConfig: {
      external: [/^@sentry\//, "canvas", "jsdom", "cssstyle", "canvaskit-wasm"],
    },
    serverDir: "./server",
    ignore: ["**/__tests__/**", "**/*.test.ts", "**/*.spec.ts"],
    ...(isElectronBuild ? { preset: "node-server" } : {}),
  } as any);
}

const config = defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  assetsInclude: ["**/*.wasm"],
  plugins: [
    devtools({
      eventBusConfig: {
        enabled: tanstackDevtoolsEventBusEnabled,
        ...(Number.isFinite(tanstackDevtoolsEventBusPort)
          ? { port: tanstackDevtoolsEventBusPort }
          : {}),
      },
    }),
    nitroPlugins,
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});

export default config;
