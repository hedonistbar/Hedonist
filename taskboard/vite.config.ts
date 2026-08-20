import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves project sites at https://<owner>.github.io/<repo>/<subpath>/,
// so the built app needs that path as its base when deployed there.
const isGithubPagesBuild = process.env.GITHUB_PAGES === "true";
const base = isGithubPagesBuild ? "/Hedonist/taskboard/" : "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
      },
      includeAssets: ["icons/apple-touch-icon.png"],
      manifest: {
        name: "Taskboard",
        short_name: "Taskboard",
        description: "Личный таск-менеджер: доски, списки, карточки",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        start_url: base,
        scope: base,
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
});
