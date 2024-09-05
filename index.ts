import "@typeberry/test-runner";
import "@typeberry/stubs";
import { main } from "@typeberry/jam/jam";
import { parseLoggerOptions } from "@typeberry/logger";

const log = parseLoggerOptions(process.env.JAM_LOG);
main();
