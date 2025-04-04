require("ts-node").register();
const { worker } = require("./worker.ts");
worker.listenToParentPort();
