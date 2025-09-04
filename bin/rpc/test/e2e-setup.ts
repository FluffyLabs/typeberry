import { NODE_DEFAULTS, loadConfig } from "@typeberry/config-node";
import { Level, Logger } from "@typeberry/logger";
import { JamConfig, importBlocks, main as node } from "@typeberry/node";

Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);

const withRelPath = (path: string) => {
  return `../../${path}`;
};

async function main() {
  const nodeConfig = loadConfig(`${import.meta.dirname}/e2e.config.json`);
  const jamConfig = JamConfig.new({ nodeName: NODE_DEFAULTS.name, nodeConfig });
  try {
    const api = await node(jamConfig, withRelPath);
    await importBlocks(api, blocksToImport);
  } catch (e) {
    console.error(`${e}`);
    process.exit(-1);
  }
}

const blocksToImport = [
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000001.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000002.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000003.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000004.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000005.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000006.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000007.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000008.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000009.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000010.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000011.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000012.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000013.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000014.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000015.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000016.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000017.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000018.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000019.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000020.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000021.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000022.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000023.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000024.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000025.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000026.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000027.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000028.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000029.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000030.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000031.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000032.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000033.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000034.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000035.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000036.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000037.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000038.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000039.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000040.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000041.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000042.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000043.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000044.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000045.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000046.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000047.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000048.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000049.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000050.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000051.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000052.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000053.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000054.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000055.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000056.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000057.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000058.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000059.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000060.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000061.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000062.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000063.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000064.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000065.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000066.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000067.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000068.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000069.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000070.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000071.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000072.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000073.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000074.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000075.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000076.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000077.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000078.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000079.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000080.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000081.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000082.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000083.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000084.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000085.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000086.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000087.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000088.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000089.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000090.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000091.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000092.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000093.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000094.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000095.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000096.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000097.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000098.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000099.json",
  "test-vectors/w3f-davxy_066/traces/reports-l1/00000100.json",
].map(withRelPath);

main();
