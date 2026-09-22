import { paddingWords } from "./padding-data.js";
import { pick } from "lodash";

// Synthetic - just enough real work to give Vite/esbuild/rolldown something
// non-trivial to transform, bundle and minify.
export function summarize() {
  return pick({ count: paddingWords.length, first: paddingWords[0] }, ["count", "first"]);
}

console.log("[main-app] loaded", summarize());
