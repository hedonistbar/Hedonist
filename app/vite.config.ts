import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves project sites at https://<owner>.github.io/<repo>/,
// so the built app needs that path as its base when deployed there.
const isGithubPagesBuild = process.env.GITHUB_PAGES === "true";

export default defineConfig({
  base: isGithubPagesBuild ? "/Hedonist/" : "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png"],
      workbox: {
        // This SW's scope is the whole /Hedonist/ site root, which would
        // otherwise make its SPA navigation fallback swallow requests to
        // /Hedonist/taskboard/ — a separate app hosted alongside this one on
        // the same GitHub Pages site — and serve app's own shell there instead.
        navigateFallbackDenylist: [/^\/Hedonist\/taskboard\//],
      },
      manifest: {
        name: "Hedonist AI-маркетолог",
        short_name: "Hedonist",
        description: "Стоп-кран, статус і команда Hedonist Bar & Kitchen",
        theme_color: "#1A130E",
        background_color: "#1A130E",
        display: "standalone",
        start_url: isGithubPagesBuild ? "/Hedonist/" : "/",
        scope: isGithubPagesBuild ? "/Hedonist/" : "/",
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
