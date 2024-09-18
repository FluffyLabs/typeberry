import { Level, Logger, parseLoggerOptions } from "@typeberry/logger";
import { main } from "./jam";

const options = parseLoggerOptions(process.env.JAM_LOG ?? "", Level.LOG);
Logger.configure(options);

main();
