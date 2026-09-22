import { defineConfig } from "vite";

export default defineConfig({
  root: "apps/fluent-report",
  build: {
    outDir: "../../dist/fluent-report",
    emptyOutDir: true,
  },
});
