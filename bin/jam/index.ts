import { Level, Logger } from "@typeberry/logger";
import { main } from "./main";

Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);

const relPath = `${__dirname}/../..`;
const files = process.argv.slice(2).map((f) => `${relPath}/${f}`);

main(files.length ? files : undefined).catch((e) => {
  console.error(e);
  process.exit(-1);
});
