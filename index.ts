import "@typeberry/test-runner";
import "@typeberry/stubs";
import { main } from "@typeberry/jam/jam";
import { Level, configureLogger, parseLoggerOptions } from "@typeberry/logger";

const options = parseLoggerOptions(process.env.JAM_LOG ?? "", Level.LOG);
configureLogger(options);

main();
