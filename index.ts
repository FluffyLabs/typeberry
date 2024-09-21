import "@typeberry/test-runner";
import "@typeberry/stubs";
import { main } from "@typeberry/jam/jam";
import { Level, Logger } from "@typeberry/logger";

Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);

main();
