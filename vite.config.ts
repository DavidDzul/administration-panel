/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url"

import vue from "@vitejs/plugin-vue"
import ViteFonts from "unplugin-fonts/vite"
import { defineConfig } from "vite"
import vuetify, { transformAssetUrls } from "vite-plugin-vuetify"

export default defineConfig({
  plugins: [
    vue({
      template: { transformAssetUrls },
    }),
    vuetify({
      autoImport: true,
    }),
    ViteFonts({
      google: {
        families: [
          {
            name: "Roboto",
            styles: "wght@100;300;400;500;700;900",
          },
        ],
      },
    }),
  ],
  define: {
    "process.env": {},
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    extensions: [".js", ".json", ".jsx", ".mjs", ".ts", ".tsx", ".vue"],
  },
  server: {
    port: 3001,
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler",
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Router guard tests lazy-load real .vue SFCs (AdminLayout/HomeView with
    // Vuetify components) as part of vue-router's navigation resolution; a
    // cold compile of that chain can exceed Vitest's 5s default.
    testTimeout: 20000,
    server: {
      deps: {
        inline: ["vuetify"],
      },
    },
  },
})
