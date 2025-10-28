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
import { runner, testFile } from "../common.js";
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
import { HostCallAccumulateTest, runHostCallAccumulateTest } from "./host-calls-accumulate.js";
import { HostCallGeneralTest, runHostCallGeneralTest } from "./host-calls-general.js";
import { HostCallRefineTest, runHostCallRefineTest } from "./host-calls-refine.js";
import { PreImagesTest, runPreImagesTest } from "./preimages.js";
import { PvmTest, runPvmTest } from "./pvm.js";
import { PvmGasCostTest, runPvmGasCostTest } from "./pvm-gas-cost.js";
import { HistoryTest, runHistoryTest } from "./recent-history.js";
import { ReportsTest, runReportsTestFull, runReportsTestTiny } from "./reports.js";
import { runSafroleTest, SafroleTest } from "./safrole.js";
import { ignoreSchemaFiles, JsonSchema } from "./schema.js";
import { runShufflingTests, shufflingTests } from "./shuffling.js";
import { runStatisticsTestFull, runStatisticsTestTiny, StatisticsTestFull, StatisticsTestTiny } from "./statistics.js";
import { runTrieTest, trieTestSuiteFromJson } from "./trie.js";

const pvmVariants: ("ananas" | "builtin")[] = ["ananas", "builtin"];

export const runners = [
  runner("accumulate/tiny", testFile.json(AccumulateTest.fromJson), runAccumulateTest, {
    chainSpecs: [tinyChainSpec],
    variants: pvmVariants,
  }),
  runner("accumulate/full", AccumulateTest.fromJson, runAccumulateTest, {
    chainSpecs: [tinyChainSpec],
    variants: pvmVariants,
  }),
  runner("assurances/tiny", AssurancesTestTiny.fromJson, runAssurancesTestTiny, tinyChainSpec),
  runner("assurances/full", AssurancesTestFull.fromJson, runAssurancesTestFull, fullChainSpec),
  runner("authorizations", AuthorizationsTest.fromJson, runAuthorizationsTest),
  ...codecRunners("tiny"),
  ...codecRunners("full"),
  runner("disputes", DisputesTest.fromJson, runDisputesTest),
  runner("erasure_coding", EcTest.fromJson, runEcTest),
  runner("history", HistoryTest.fromJson, runHistoryTest),
  runner("schema", JsonSchema.fromJson, ignoreSchemaFiles), // ignore schema files
  runner("preimages", PreImagesTest.fromJson, runPreImagesTest),
  runner("pvm", PvmTest.fromJson, runPvmTest),
  runner("gas-cost-tests", PvmGasCostTest.fromJson, runPvmGasCostTest),
  runner("host_function", HostCallGeneralTest.fromJson, runHostCallGeneralTest),
  runner("host_function", HostCallAccumulateTest.fromJson, runHostCallAccumulateTest),
  runner("host_function", HostCallRefineTest.fromJson, runHostCallRefineTest),
  runner("reports/tiny", ReportsTest.fromJson, runReportsTestTiny, tinyChainSpec),
  runner("reports/full", ReportsTest.fromJson, runReportsTestFull, fullChainSpec),
  runner("safrole", SafroleTest.fromJson, runSafroleTest),
  runner("shuffle", shufflingTests, runShufflingTests),
  runner("statistics/tiny", StatisticsTestTiny.fromJson, runStatisticsTestTiny, tinyChainSpec),
  runner("statistics/full", StatisticsTestFull.fromJson, runStatisticsTestFull, fullChainSpec),
  runner("trie", trieTestSuiteFromJson, runTrieTest),
  runner("traces", StateTransition.fromJson, runStateTransition, tinyChainSpec, StateTransition.Codec),
  runner("traces", StateTransition.fromJson, runStateTransition, ["ananas", "builtin"]),
];

function codecRunners(flavor: "tiny" | "full") {
  const spec = flavor === "tiny" ? tinyChainSpec : fullChainSpec;
  return [
    runner(
      `codec/${flavor}/assurances_extrinsic`,
      getAssurancesExtrinsicFromJson(spec),
      runAssurancesExtrinsicTest,
      spec,
    ),
    runner(`codec/${flavor}/block`, blockFromJson(spec), runBlockTest, spec),
    runner(`codec/${flavor}/disputes_extrinsic`, disputesExtrinsicFromJson, runDisputesExtrinsicTest, spec),
    runner(`codec/${flavor}/extrinsic`, getExtrinsicFromJson(spec), runExtrinsicTest, spec),
    runner(`codec/${flavor}/guarantees_extrinsic`, guaranteesExtrinsicFromJson, runGuaranteesExtrinsicTest, spec),
    runner(`codec/${flavor}/header`, headerFromJson, runHeaderTest, spec),
    runner(`codec/${flavor}/preimages_extrinsic`, preimagesExtrinsicFromJson, runPreimagesExtrinsicTest, spec),
    runner(`codec/${flavor}/refine_context`, refineContextFromJson, runRefineContextTest, spec),
    runner(`codec/${flavor}/tickets_extrinsic`, ticketsExtrinsicFromJson, runTicketsExtrinsicTest, spec),
    runner(`codec/${flavor}/work_item`, workItemFromJson, runWorkItemTest, spec),
    runner(`codec/${flavor}/work_package`, workPackageFromJson, runWorkPackageTest, spec),
    runner(`codec/${flavor}/work_report`, workReportFromJson, runWorkReportTest, spec),
    runner(`codec/${flavor}/work_result`, workResultFromJson, runWorkResultTest, spec),
  ];
}
