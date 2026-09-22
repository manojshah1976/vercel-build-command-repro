import { defineConfig } from "vite";

export default defineConfig({
  root: "apps/main-app",
  build: {
    outDir: "../../dist/main-app",
    emptyOutDir: true,
  },
});
