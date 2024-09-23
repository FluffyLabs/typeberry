import { Level, Logger } from "@typeberry/logger";
import { main } from "./jam";

Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);

main();
