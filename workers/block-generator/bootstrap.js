require("ts-node").register();

const log = require('@typeberry/logger');
log.configureLogger(log.parseLoggerOptions(process.env.JAM_LOG ?? '', log.Level.DEBUG));
require("./index.ts");
