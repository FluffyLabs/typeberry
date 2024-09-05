import { Level, configureLogger, parseLoggerOptions } from "@typeberry/logger";
import { main } from "./jam";

const options = parseLoggerOptions(process.env.JAM_LOG ?? "", Level.DEBUG);
configureLogger(options);

main();
