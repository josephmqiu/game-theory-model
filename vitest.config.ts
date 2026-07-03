import { fileURLToPath, URL } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";

// Dedicated vitest config (takes precedence over vite.config.ts).
//
// The app's vite config loads tanstackStart()/nitro()/devtools() — under
// vitest those plugins split React into two differently-resolved instances,
// so every hooks component crashed in jsdom with "Cannot read properties of
// null (reading 'useState')" (the long-standing issue behind the abandoned
// minimal-hook/overlay-ping debug tests). Tests only need the react plugin
// and path aliases.
export default defineConfig({
  test: {
    teardownTimeout: 1000,
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
    viteReact(),
  ],
});
