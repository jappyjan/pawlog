import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: false,
      injectManifest: { globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"] },
      devOptions: { enabled: false },
      manifest: {
        id: "/",
        name: "Pawlog — dog tracker",
        short_name: "Pawlog",
        description: "Walks, potty, meds, weight, reminders and papers for your dog.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#fbf7f1",
        theme_color: "#fbf7f1",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Log a walk", url: "/?quick=walk", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
          { name: "Reminders", url: "/reminders", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
        ],
      },
    }),
  ],
});
