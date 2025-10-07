import { main } from "./main.js";

main(process.argv.slice(2)).catch((e) => {
  // biome-ignore lint/suspicious/noConsole: bin file
  console.error(e);
  process.exit(-1);
});
