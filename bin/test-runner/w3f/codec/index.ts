import { Header } from "@typeberry/block";
import { type AssurancesExtrinsic, assurancesExtrinsicCodec } from "@typeberry/block/assurances.js";
import { Block, Extrinsic } from "@typeberry/block/block.js";
import { DisputesExtrinsic } from "@typeberry/block/disputes.js";
import { type GuaranteesExtrinsic, guaranteesExtrinsicCodec } from "@typeberry/block/guarantees.js";
import { type PreimagesExtrinsic, preimagesExtrinsicCodec } from "@typeberry/block/preimage.js";
import { RefineContext } from "@typeberry/block/refine-context.js";
import { type TicketsExtrinsic, ticketsExtrinsicCodec } from "@typeberry/block/tickets.js";
import { WorkReport } from "@typeberry/block/work-report.js";
import { WorkResult } from "@typeberry/block/work-result.js";
import { runCodecTest } from "./common.js";

export async function runAssurancesExtrinsicTest(test: AssurancesExtrinsic, file: string) {
  runCodecTest(assurancesExtrinsicCodec, test, file);
}

export async function runBlockTest(test: Block, file: string) {
  runCodecTest(Block.Codec, test, file);
}

export async function runDisputesExtrinsicTest(test: DisputesExtrinsic, file: string) {
  runCodecTest(DisputesExtrinsic.Codec, test, file);
}

export async function runExtrinsicTest(test: Extrinsic, file: string) {
  runCodecTest(Extrinsic.Codec, test, file);
}

export async function runGuaranteesExtrinsicTest(test: GuaranteesExtrinsic, file: string) {
  runCodecTest(guaranteesExtrinsicCodec, test, file);
}

export async function runHeaderTest(test: Header, file: string) {
  runCodecTest(Header.Codec, test, file);
}

export async function runPreimagesExtrinsicTest(test: PreimagesExtrinsic, file: string) {
  runCodecTest(preimagesExtrinsicCodec, test, file);
}

export async function runRefineContextTest(test: RefineContext, file: string) {
  runCodecTest(RefineContext.Codec, test, file);
}

export async function runTicketsExtrinsicTest(test: TicketsExtrinsic, file: string) {
  runCodecTest(ticketsExtrinsicCodec, test, file);
}

export async function runWorkReportTest(test: WorkReport, file: string) {
  runCodecTest(WorkReport.Codec, test, file);
}

export async function runWorkResultTest(test: WorkResult, file: string) {
  runCodecTest(WorkResult.Codec, test, file);
}
