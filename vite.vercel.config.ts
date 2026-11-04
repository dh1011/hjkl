import { defineConfig } from "vite";
import vinext from "vinext";
import { nitro } from "nitro/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      tailwindcss: fileURLToPath(new URL("./node_modules/tailwindcss/index.css", import.meta.url)),
      "tw-animate-css": fileURLToPath(new URL("./node_modules/tw-animate-css/dist/tw-animate.css", import.meta.url)),
    },
  },
  plugins: [vinext(), nitro({ preset: "vercel" })],
});
