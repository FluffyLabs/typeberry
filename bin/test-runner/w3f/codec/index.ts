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
import type { RunOptions } from "../../common.js";
import { runCodecTest } from "./common.js";

export async function runAssurancesExtrinsicTest(test: AssurancesExtrinsic, { path: file }: RunOptions) {
  runCodecTest(assurancesExtrinsicCodec, test, file);
}

export async function runBlockTest(test: Block, { path: file }: RunOptions) {
  runCodecTest(Block.Codec, test, file);
}

export async function runDisputesExtrinsicTest(test: DisputesExtrinsic, { path: file }: RunOptions) {
  runCodecTest(DisputesExtrinsic.Codec, test, file);
}

export async function runExtrinsicTest(test: Extrinsic, { path: file }: RunOptions) {
  runCodecTest(Extrinsic.Codec, test, file);
}

export async function runGuaranteesExtrinsicTest(test: GuaranteesExtrinsic, { path: file }: RunOptions) {
  runCodecTest(guaranteesExtrinsicCodec, test, file);
}

export async function runHeaderTest(test: Header, { path: file }: RunOptions) {
  runCodecTest(Header.Codec, test, file);
}

export async function runPreimagesExtrinsicTest(test: PreimagesExtrinsic, { path: file }: RunOptions) {
  runCodecTest(preimagesExtrinsicCodec, test, file);
}

export async function runRefineContextTest(test: RefineContext, { path: file }: RunOptions) {
  runCodecTest(RefineContext.Codec, test, file);
}

export async function runTicketsExtrinsicTest(test: TicketsExtrinsic, { path: file }: RunOptions) {
  runCodecTest(ticketsExtrinsicCodec, test, file);
}

export async function runWorkReportTest(test: WorkReport, { path: file }: RunOptions) {
  runCodecTest(WorkReport.Codec, test, file);
}

export async function runWorkResultTest(test: WorkResult, { path: file }: RunOptions) {
  runCodecTest(WorkResult.Codec, test, file);
}
