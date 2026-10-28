import { resolve } from "node:path";
import { defineConfig } from "vite";

// Builds one self-contained IIFE file that a business pastes as a
// <script> tag. Output goes straight into the web app's /public so
// Next serves it at /widget.js (and on Vercel, from the CDN).
export default defineConfig({
  esbuild: { jsx: "automatic", jsxImportSource: "preact" },
  build: {
    outDir: resolve(__dirname, "../web/public"),
    emptyOutDir: false,
    target: "es2019",
    lib: {
      entry: resolve(__dirname, "src/main.tsx"),
      name: "FrontDeskWidget",
      formats: ["iife"],
      fileName: () => "widget.js",
    },
  },
});
