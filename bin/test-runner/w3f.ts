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
import { tinyChainSpec } from "@typeberry/config";
import { logger, main, runner } from "./common";
import { AccumulateTest, runAccumulateTest } from "./w3f/accumulate";
import { AssurancesTestFull, AssurancesTestTiny, runAssurancesTestFull, runAssurancesTestTiny } from "./w3f/assurances";
import { AuthorizationsTest, runAuthorizationsTest } from "./w3f/authorizations";
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
} from "./w3f/codec";
import { runWorkItemTest, workItemFromJson } from "./w3f/codec/work-item";
import { runWorkPackageTest, workPackageFromJson } from "./w3f/codec/work-package";
import { DisputesTest, runDisputesTest } from "./w3f/disputes";
import {
  EcTest,
  PageProof,
  SegmentEcTest,
  SegmentRoot,
  runEcTest,
  runPageProofTest,
  runSegmentEcTest,
  runSegmentRootTest,
} from "./w3f/erasure-coding";
import { HostCallAccumulateTest, runHostCallAccumulateTest } from "./w3f/host-calls-accumulate";
import { HostCallGeneralTest, runHostCallGeneralTest } from "./w3f/host-calls-general";
import { HostCallRefineTest, runHostCallRefineTest } from "./w3f/host-calls-refine";
import { PreImagesTest, runPreImagesTest } from "./w3f/preimages";
import { PvmTest, runPvmTest } from "./w3f/pvm";
import { HistoryTest, runHistoryTest } from "./w3f/recent-history";
import { ReportsTest, runReportsTestFull, runReportsTestTiny } from "./w3f/reports";
import { SafroleTest, runSafroleTest } from "./w3f/safrole";
import { JsonSchema, ignoreSchemaFiles } from "./w3f/schema";
import { runShufflingTests, shufflingTests } from "./w3f/shuffling";
import { StatisticsTestFull, StatisticsTestTiny, runStatisticsTestFull, runStatisticsTestTiny } from "./w3f/statistics";
import { runTrieTest, trieTestSuiteFromJson } from "./w3f/trie";

const runners = [
  runner("accumulate", AccumulateTest.fromJson, runAccumulateTest),
  runner("assurances/tiny", AssurancesTestTiny.fromJson, runAssurancesTestTiny),
  runner("assurances/full", AssurancesTestFull.fromJson, runAssurancesTestFull),
  runner("authorizations", AuthorizationsTest.fromJson, runAuthorizationsTest),
  runner("codec/assurances_extrinsic", getAssurancesExtrinsicFromJson(tinyChainSpec), runAssurancesExtrinsicTest),
  runner("codec/block", blockFromJson(tinyChainSpec), runBlockTest),
  runner("codec/disputes_extrinsic", disputesExtrinsicFromJson, runDisputesExtrinsicTest),
  runner("codec/extrinsic", getExtrinsicFromJson(tinyChainSpec), runExtrinsicTest),
  runner("codec/guarantees_extrinsic", guaranteesExtrinsicFromJson, runGuaranteesExtrinsicTest),
  runner("codec/header", headerFromJson, runHeaderTest),
  runner("codec/preimages_extrinsic", preimagesExtrinsicFromJson, runPreimagesExtrinsicTest),
  runner("codec/refine_context", refineContextFromJson, runRefineContextTest),
  runner("codec/tickets_extrinsic", ticketsExtrinsicFromJson, runTicketsExtrinsicTest),
  runner("codec/work_item", workItemFromJson, runWorkItemTest),
  runner("codec/work_package", workPackageFromJson, runWorkPackageTest),
  runner("codec/work_report", workReportFromJson, runWorkReportTest),
  runner("codec/work_result", workResultFromJson, runWorkResultTest),
  runner("disputes", DisputesTest.fromJson, runDisputesTest),
  runner("erasure_coding", EcTest.fromJson, runEcTest),
  runner("erasure_coding/page_proof", PageProof.fromJson, runPageProofTest),
  runner("erasure_coding/segment_ec", SegmentEcTest.fromJson, runSegmentEcTest),
  runner("erasure_coding/segment_root", SegmentRoot.fromJson, runSegmentRootTest),
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
];

main(runners, "jamtestvectors", process.argv.slice(2))
  .then((r) => logger.log(r))
  .catch((e) => {
    logger.error(`${e}`);
    process.exit(-1);
  });
