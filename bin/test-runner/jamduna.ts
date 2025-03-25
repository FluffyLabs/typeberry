import { logger, main } from "./common";

const runners = [];

main(runners, "jamtestnet")
  .then((r) => logger.log(r))
  .catch((e) => {
    logger.error(e);
    process.exit(-1);
  });
