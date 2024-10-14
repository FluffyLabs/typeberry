require("ts-node").register();

const log = require("@typeberry/logger");
log.Logger.configureAll(process.env.JAM_LOG ?? "", log.Level.DEBUG);
require("./index.ts");
