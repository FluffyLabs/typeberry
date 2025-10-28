import {
  blockFromJson,
  disputesExtrinsicFromJson,
  getAssurancesExtrinsicFromJson,
  getExtrinsicFromJson,
  guaranteesExtrinsicFromJson,
  headerFromJson,
  preimagesExtrinsicFromJson,
  refineContextFromJson,
  ticketsExtrinsicFromJson,
  workReportFromJson,
  workResultFromJson,
} from "@typeberry/block-json";
import { fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { runner } from "../common.js";
import { runStateTransition, StateTransition } from "../state-transition/state-transition.js";
import { AccumulateTest, runAccumulateTest } from "./accumulate.js";
import { AssurancesTestFull, AssurancesTestTiny, runAssurancesTestFull, runAssurancesTestTiny } from "./assurances.js";
import { AuthorizationsTest, runAuthorizationsTest } from "./authorizations.js";
import {
  runAssurancesExtrinsicTest,
  runBlockTest,
  runDisputesExtrinsicTest,
  runExtrinsicTest,
  runGuaranteesExtrinsicTest,
  runHeaderTest,
  runPreimagesExtrinsicTest,
  runRefineContextTest,
  runTicketsExtrinsicTest,
  runWorkReportTest,
  runWorkResultTest,
} from "./codec/index.js";
import { runWorkItemTest, workItemFromJson } from "./codec/work-item.js";
import { runWorkPackageTest, workPackageFromJson } from "./codec/work-package.js";
import { DisputesTest, runDisputesTest } from "./disputes.js";
import { EcTest, runEcTest } from "./erasure-coding.js";
import { PreImagesTest, runPreImagesTest } from "./preimages.js";
import { PvmTest, runPvmTest } from "./pvm.js";
import { PvmGasCostTest, runPvmGasCostTest } from "./pvm-gas-cost.js";
import { HistoryTest, runHistoryTest } from "./recent-history.js";
import { ReportsTest, runReportsTest } from "./reports.js";
import { runSafroleTest, SafroleTest } from "./safrole.js";
import { ignoreSchemaFiles, JsonSchema } from "./schema.js";
import { runShufflingTests, shufflingTestsFromJson } from "./shuffling.js";
import { runStatisticsTestFull, runStatisticsTestTiny, StatisticsTestFull, StatisticsTestTiny } from "./statistics.js";
import { runTrieTest, trieTestSuiteFromJson } from "./trie.js";

const pvms: ("ananas" | "builtin")[] = ["ananas", "builtin"];
const tiny = [tinyChainSpec];
const full = [fullChainSpec];
const tinyFull = [...tiny, ...full];

export const runners = [
  runner("accumulate", runAccumulateTest, tinyFull).fromJson(AccumulateTest.fromJson).withVariants(pvms),
  runner("assurances/tiny", runAssurancesTestTiny, tiny).fromJson(AssurancesTestTiny.fromJson),
  runner("assurances/full", runAssurancesTestFull, full).fromJson(AssurancesTestFull.fromJson),
  runner("authorizations", runAuthorizationsTest, tinyFull).fromJson(AuthorizationsTest.fromJson),
  ...codecRunners("tiny"),
  ...codecRunners("full"),
  runner("disputes", runDisputesTest, tinyFull).fromJson(DisputesTest.fromJson),
  runner("erasure_coding", runEcTest, tinyFull).fromJson(EcTest.fromJson),
  runner("history", runHistoryTest, tinyFull).fromJson(HistoryTest.fromJson),
  runner("schema", ignoreSchemaFiles).fromJson(JsonSchema.fromJson), // ignore schema files
  runner("preimages", runPreImagesTest, tinyFull).fromJson(PreImagesTest.fromJson),
  runner("pvm", runPvmTest).fromJson(PvmTest.fromJson),
  runner("gas-cost-tests", runPvmGasCostTest).fromJson(PvmGasCostTest.fromJson),
  runner("reports", runReportsTest, tinyFull).fromJson(ReportsTest.fromJson),
  runner("safrole", runSafroleTest, tinyFull).fromJson(SafroleTest.fromJson),
  runner("shuffle", runShufflingTests).fromJson(shufflingTestsFromJson),
  runner("statistics/tiny", runStatisticsTestTiny, tiny).fromJson(StatisticsTestTiny.fromJson),
  runner("statistics/full", runStatisticsTestFull, full).fromJson(StatisticsTestFull.fromJson),
  runner("trie", runTrieTest).fromJson(trieTestSuiteFromJson),
  runner("traces", runStateTransition)
    .fromJson(StateTransition.fromJson)
    .fromBin(StateTransition.Codec)
    .withVariants(pvms),
].map((b) => b.build());

function codecRunners(flavor: "tiny" | "full") {
  const spec = flavor === "tiny" ? tinyChainSpec : fullChainSpec;
  return [
    runner(`codec/${flavor}/assurances_extrinsic`, runAssurancesExtrinsicTest, [spec]).fromJson(
      getAssurancesExtrinsicFromJson(spec),
    ),
    runner(`codec/${flavor}/block`, runBlockTest, [spec]).fromJson(blockFromJson(spec)),
    runner(`codec/${flavor}/disputes_extrinsic`, runDisputesExtrinsicTest, [spec]).fromJson(disputesExtrinsicFromJson),
    runner(`codec/${flavor}/extrinsic`, runExtrinsicTest, [spec]).fromJson(getExtrinsicFromJson(spec)),
    runner(`codec/${flavor}/guarantees_extrinsic`, runGuaranteesExtrinsicTest, [spec]).fromJson(
      guaranteesExtrinsicFromJson,
    ),
    runner(`codec/${flavor}/header`, runHeaderTest, [spec]).fromJson(headerFromJson),
    runner(`codec/${flavor}/preimages_extrinsic`, runPreimagesExtrinsicTest, [spec]).fromJson(
      preimagesExtrinsicFromJson,
    ),
    runner(`codec/${flavor}/refine_context`, runRefineContextTest, [spec]).fromJson(refineContextFromJson),
    runner(`codec/${flavor}/tickets_extrinsic`, runTicketsExtrinsicTest, [spec]).fromJson(ticketsExtrinsicFromJson),
    runner(`codec/${flavor}/work_item`, runWorkItemTest, [spec]).fromJson(workItemFromJson),
    runner(`codec/${flavor}/work_package`, runWorkPackageTest, [spec]).fromJson(workPackageFromJson),
    runner(`codec/${flavor}/work_report`, runWorkReportTest, [spec]).fromJson(workReportFromJson),
    runner(`codec/${flavor}/work_result`, runWorkResultTest, [spec]).fromJson(workResultFromJson),
  ];
}
