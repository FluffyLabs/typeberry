import { tsImport } from "tsx/esm/api";

const { worker } = await tsImport("./worker.ts", import.meta.url);
worker.listenToParentPort();
