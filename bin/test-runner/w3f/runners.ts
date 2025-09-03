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
import { StateTransition, runStateTransition } from "../state-transition/state-transition.js";
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
import { HistoryTest, runHistoryTest } from "./recent-history.js";
import { ReportsTest, runReportsTestFull, runReportsTestTiny } from "./reports.js";
import { SafroleTest, runSafroleTest } from "./safrole.js";
import { JsonSchema, ignoreSchemaFiles } from "./schema.js";
import { runShufflingTests, shufflingTests } from "./shuffling.js";
import { StatisticsTestFull, StatisticsTestTiny, runStatisticsTestFull, runStatisticsTestTiny } from "./statistics.js";
import { runTrieTest, trieTestSuiteFromJson } from "./trie.js";

export const runners = [
  runner("accumulate", AccumulateTest.fromJson, runAccumulateTest),
  runner("assurances/tiny", AssurancesTestTiny.fromJson, runAssurancesTestTiny),
  runner("assurances/full", AssurancesTestFull.fromJson, runAssurancesTestFull),
  runner("authorizations", AuthorizationsTest.fromJson, runAuthorizationsTest),
  ...codecRunners("tiny"),
  ...codecRunners("full"),
  runner("disputes", DisputesTest.fromJson, runDisputesTest),
  runner("erasure_coding", EcTest.fromJson, runEcTest),
  runner("history", HistoryTest.fromJson, runHistoryTest),
  runner("schema", JsonSchema.fromJson, ignoreSchemaFiles), // ignore schema files
  runner("preimages", PreImagesTest.fromJson, runPreImagesTest),
  runner("pvm", PvmTest.fromJson, runPvmTest),
  runner("host_function", HostCallGeneralTest.fromJson, runHostCallGeneralTest),
  runner("host_function", HostCallAccumulateTest.fromJson, runHostCallAccumulateTest),
  runner("host_function", HostCallRefineTest.fromJson, runHostCallRefineTest),
  runner("reports/tiny", ReportsTest.fromJson, runReportsTestTiny),
  runner("reports/full", ReportsTest.fromJson, runReportsTestFull),
  runner("safrole", SafroleTest.fromJson, runSafroleTest),
  runner("shuffle", shufflingTests, runShufflingTests),
  runner("statistics/tiny", StatisticsTestTiny.fromJson, runStatisticsTestTiny),
  runner("statistics/full", StatisticsTestFull.fromJson, runStatisticsTestFull),
  runner("trie", trieTestSuiteFromJson, runTrieTest),
  runner("traces", StateTransition.fromJson, runStateTransition),
];

function codecRunners(flavor: "tiny" | "full") {
  const spec = flavor === "tiny" ? tinyChainSpec : fullChainSpec;
  return [
    runner(`codec/${flavor}/assurances_extrinsic`, getAssurancesExtrinsicFromJson(spec), runAssurancesExtrinsicTest),
    runner(`codec/${flavor}/block`, blockFromJson(spec), runBlockTest),
    runner(`codec/${flavor}/disputes_extrinsic`, disputesExtrinsicFromJson, runDisputesExtrinsicTest),
    runner(`codec/${flavor}/extrinsic`, getExtrinsicFromJson(spec), runExtrinsicTest),
    runner(`codec/${flavor}/guarantees_extrinsic`, guaranteesExtrinsicFromJson, runGuaranteesExtrinsicTest),
    runner(`codec/${flavor}/header`, headerFromJson, runHeaderTest),
    runner(`codec/${flavor}/preimages_extrinsic`, preimagesExtrinsicFromJson, runPreimagesExtrinsicTest),
    runner(`codec/${flavor}/refine_context`, refineContextFromJson, runRefineContextTest),
    runner(`codec/${flavor}/tickets_extrinsic`, ticketsExtrinsicFromJson, runTicketsExtrinsicTest),
    runner(`codec/${flavor}/work_item`, workItemFromJson, runWorkItemTest),
    runner(`codec/${flavor}/work_package`, workPackageFromJson, runWorkPackageTest),
    runner(`codec/${flavor}/work_report`, workReportFromJson, runWorkReportTest),
    runner(`codec/${flavor}/work_result`, workResultFromJson, runWorkResultTest),
  ];
}
