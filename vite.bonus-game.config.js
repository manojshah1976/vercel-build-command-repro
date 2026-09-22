import { defineConfig } from "vite";

export default defineConfig({
  root: "apps/bonus-game",
  build: {
    outDir: "../../dist/bonus-game",
    emptyOutDir: true,
  },
});
