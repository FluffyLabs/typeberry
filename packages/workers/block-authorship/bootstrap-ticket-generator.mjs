// Worker bootstrap: Node loads this `.mjs` natively, and we use tsx's programmatic
// API to import the TypeScript worker entry point (worker threads do not inherit
// the tsx loader). Mirrors the other `bootstrap-*.mjs` files in this repo.
import { tsImport } from "tsx/esm/api";

await tsImport("./ticket-generator.worker.ts", import.meta.url);
